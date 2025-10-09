// src/lib/tags.ts
// PURPOSE: Normalize tags and attach or detach them from Contacts and Interactions using explicit join tables.
// MULTI TENANT: Verify parent ownership by userId and constrain Tag lookups to the same userId.
// SECURITY: Never log plaintext PII. Only log ids or slugs. All IT code is commented and uses hyphens only.

import { prisma } from '$lib/db';
import { createEmbeddingForText } from './embeddings_api'; // IT: reuse the same helper


// Simple slug generator - lowercase and hyphenate.
const TAG_SLUG_RE = /[^a-z0-9]+/g;
export function slugifyTag(input: string) {
  return input.trim().toLowerCase().replace(TAG_SLUG_RE, '-').replace(/^-+|-+$/g, '');
}

// IT: helper - store a pgvector for a tag's display name
async function ensureTagEmbeddingVec(tagId: string, userId: string, label: string) {
  try {
    // IT: compute tag vocabulary vector
    const vec = await createEmbeddingForText(label);
    if (!Array.isArray(vec) || vec.length === 0) return;

    // IT: convert to pgvector text literal and persist via raw SQL
    const literal = `[${vec.join(',')}]`;
    await prisma.$executeRawUnsafe(
      'UPDATE "Tag" SET "embedding_vec" = $1::vector WHERE "id" = $2 AND "userId" = $3',
      literal,
      tagId,
      userId
    );
  } catch {
    // IT: best effort only - suggestions will just skip this tag until next write
  }
}


/**
 * Resolve or create a Tag in a tenant by display name.
 * - Uses slug for equality and alias resolution.
 * - Returns the Tag id and slug.
 * - createdBy in the Tag table is set from the provenance argument.
 */
async function resolveOrCreateTagForTenant(
  userId: string,
  name: string,
  provenance: 'user' | 'ai' = 'user'
): Promise<{ id: string; slug: string }> {
  const slug = slugifyTag(name);
  if (!slug) throw new Error('Empty tag');

  // Try exact Tag by slug for this tenant.
  const existing = await prisma.tag.findFirst({
    where: { userId, slug },
    select: { id: true, slug: true }
  });
  if (existing) return existing;

  // Try TagAlias - tenant is implicit via the related Tag.userId.
  const alias = await prisma.tagAlias.findFirst({
    where: { slug, tag: { userId } },
    select: { tag: { select: { id: true, slug: true } } }
  });
  if (alias?.tag) return { id: alias.tag.id, slug: alias.tag.slug };

  // Create a new Tag for this tenant - store original human name plus slug.
  try {
    const created = await prisma.tag.create({
      data: { userId, name, slug, createdBy: provenance }
    });

    // IT: seed pgvector for this tag so suggestions work immediately
    await ensureTagEmbeddingVec(created.id, userId, name);

    return { id: created.id, slug: created.slug };
  } catch {
    // Race guard - requery if another request created it first.
    const again = await prisma.tag.findFirst({
      where: { userId, slug },
      select: { id: true, slug: true }
    });
    if (again) return again;
    throw new Error('Failed to create tag');
  }
}


/**
 * Attach tags to a Contact by names using the ContactTag join model.
 * - Verifies the contact belongs to the tenant.
 * - Upserts join rows by composite key to be idempotent.
 * - Sets assignedBy from provenance since the join column is required.
 */
export async function attachContactTags(
  userId: string,
  contactId: string,
  names: string[],
  provenance: 'user' | 'ai' = 'user'
) {
  // Verify parent ownership in this tenant.
  const contact = await prisma.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } });
  if (!contact) throw new Error('Contact not found in tenant');

  // Resolve each tag id then upsert the join row.
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  for (const name of unique) {
    const { id: tagId } = await resolveOrCreateTagForTenant(userId, name, provenance);
    await prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      update: {},
      create: { contactId, tagId, assignedBy: provenance }
    });
  }
}

/**
 * Detach a single tag from a Contact by slug within a tenant.
 */
export async function detachContactTag(userId: string, contactId: string, slug: string) {
  // Verify parent ownership.
  const contact = await prisma.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } });
  if (!contact) throw new Error('Contact not found in tenant');

  // Find tag id limited to tenant.
  const tag = await prisma.tag.findFirst({ where: { userId, slug }, select: { id: true } });
  if (!tag) return;

  await prisma.contactTag.deleteMany({ where: { contactId, tagId: tag.id } });
}

/**
 * Attach tags to an Interaction by names using the InteractionTag join model.
 * - Verifies interaction belongs to the tenant.
 * - Sets assignedBy from provenance since the join column is required.
 */
export async function attachInteractionTags(
  userId: string,
  interactionId: string,
  names: string[],
  provenance: 'user' | 'ai' = 'user'
) {
  // Verify parent ownership.
  const it = await prisma.interaction.findFirst({ where: { id: interactionId, userId }, select: { id: true } });
  if (!it) throw new Error('Interaction not found in tenant');

  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  for (const name of unique) {
    const { id: tagId } = await resolveOrCreateTagForTenant(userId, name, provenance);
    await prisma.interactionTag.upsert({
      where: { interactionId_tagId: { interactionId, tagId } },
      update: {},
      create: { interactionId, tagId, assignedBy: provenance }
    });
  }
}

/**
 * Detach a single tag from an Interaction by slug within a tenant.
 */
export async function detachInteractionTag(userId: string, interactionId: string, slug: string) {
  // Verify parent ownership.
  const it = await prisma.interaction.findFirst({ where: { id: interactionId, userId }, select: { id: true } });
  if (!it) throw new Error('Interaction not found in tenant');

  const tag = await prisma.tag.findFirst({ where: { userId, slug }, select: { id: true } });
  if (!tag) return;

  await prisma.interactionTag.deleteMany({ where: { interactionId, tagId: tag.id } });
}
