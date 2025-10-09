// src/lib/tags.ts
// PURPOSE: Contact-centric tagging utilities.
// - Tags are tenant scoped and attached to Contacts via ContactTag
// - New tags are created with provenance and immediately seeded with pgvector
// - Aliases are supported via TagAlias and looked up by slug
// SECURITY: Server only. All queries are tenant scoped by userId.
// NOTES: No em dashes are used in comments.

import { prisma } from '$lib/db';
import { createEmbeddingForText } from './embeddings_api';

// Toggle verbose logs for tag flows - set to false when done debugging
const DEBUG_TAGS = true;

// Simple slugifier - lower case, trim, replace non alphanum with hyphen, collapse hyphens
export function slugifyTag(input: string): string {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')   // replace runs of non alphanum with hyphen
    .replace(/^-+|-+$/g, '')       // trim leading or trailing hyphens
    .replace(/-{2,}/g, '-');       // collapse multiple hyphens
}

// Best effort - compute and store pgvector for a tag's label
async function ensureTagEmbeddingVec(tagId: string, userId: string, label: string) {
  try {
    const vec = await createEmbeddingForText(label);
    if (!Array.isArray(vec) || vec.length === 0) {
      if (DEBUG_TAGS) console.warn('[tags] ensureTagEmbeddingVec - empty vector', { tagId, label });
      return;
    }
    const literal = `[${vec.join(',')}]`;
    await prisma.$executeRawUnsafe(
      'UPDATE "Tag" SET "embedding_vec" = $1::vector WHERE "id" = $2 AND "userId" = $3',
      literal,
      tagId,
      userId
    );
    if (DEBUG_TAGS) console.log('[tags] ensureTagEmbeddingVec - stored vector', { tagId });
  } catch (e: any) {
    if (DEBUG_TAGS) {
      console.warn('[tags] ensureTagEmbeddingVec - failed', {
        tagId,
        message: e?.message,
        code: e?.code
      });
    }
  }
}

// Resolve or create a Tag for this tenant, then seed its vector
export async function resolveOrCreateTagForTenant(
  userId: string,
  name: string,
  provenance: 'user' | 'ai' = 'user'
): Promise<{ id: string; slug: string; name: string }> {
  const slug = slugifyTag(name);
  if (!slug) throw new Error('Empty tag');

  if (DEBUG_TAGS) console.log('[tags] resolveOrCreateTagForTenant start', { userId, name, slug, provenance });

  // Exact tag by slug for this tenant
  const existing = await prisma.tag.findFirst({
    where: { userId, slug },
    select: { id: true, slug: true, name: true }
  });
  if (existing) {
    if (DEBUG_TAGS) console.log('[tags] existing tag found', existing);
    return existing;
  }

  // Alias lookup - tenant scoped via related Tag
  const alias = await prisma.tagAlias.findFirst({
    where: { slug, tag: { userId } },
    select: { tag: { select: { id: true, slug: true, name: true } } }
  });
  if (alias?.tag) {
    if (DEBUG_TAGS) console.log('[tags] alias matched canonical tag', alias.tag);
    return { id: alias.tag.id, slug: alias.tag.slug, name: alias.tag.name };
  }

  // Create new tag
  if (DEBUG_TAGS) console.log('[tags] creating new tag', { userId, name, slug, provenance });
  const created = await prisma.tag.create({
    data: { userId, name, slug, createdBy: provenance }
  });
  if (DEBUG_TAGS) console.log('[tags] created tag row', created);

  // Best effort vector seed
  await ensureTagEmbeddingVec(created.id, userId, name);

  return { id: created.id, slug: created.slug, name: created.name };
}

// Attach tags to a Contact - object args
export async function attachContactTags(params: {
  userId: string;
  contactId: string;
  names: string[];
  provenance?: 'user' | 'ai';
}): Promise<void> {
  const { userId, contactId } = params;
  const provenance = params.provenance ?? 'user';

  const names = Array.from(
    new Set(
      (params.names || [])
        .map((n) => String(n || '').trim())
        .filter((n) => n.length > 0)
    )
  );

  if (DEBUG_TAGS) console.log('[tags] attachContactTags start', { userId, contactId, names, provenance });

  if (names.length === 0) {
    if (DEBUG_TAGS) console.log('[tags] attachContactTags no names - exit');
    return;
  }

  for (const name of names) {
    let tag: { id: string; slug: string; name: string } | null = null;
    try {
      tag = await resolveOrCreateTagForTenant(userId, name, provenance);
    } catch (e: any) {
      console.error('[tags] resolveOrCreateTagForTenant error', { name, message: e?.message, code: e?.code });
      continue;
    }

    if (!tag) continue;

    try {
      if (DEBUG_TAGS) console.log('[tags] contactTag.create linking', { contactId, tagId: tag.id });
      await prisma.contactTag.create({
        data: {
          contactId,
          tagId: tag.id,
          assignedBy: provenance
        }
      });
      if (DEBUG_TAGS) console.log('[tags] contactTag.create success', { contactId, tagId: tag.id });
    } catch (e: any) {
      // Likely a duplicate link due to composite PK - log and continue
      if (DEBUG_TAGS) {
        console.warn('[tags] contactTag.create failed', {
          contactId,
          tagId: tag.id,
          message: e?.message,
          code: e?.code
        });
      }
    }
  }

  // Final check - log what the DB now has for this contact
  try {
    const linked = await prisma.contactTag.findMany({
      where: { contactId },
      select: { tag: { select: { id: true, name: true, slug: true } } },
      orderBy: { tagId: 'asc' }
    });
    if (DEBUG_TAGS) console.log('[tags] contact now has tags', linked.map((x) => x.tag));
  } catch {
    // ignore
  }
}

// Detach a single tag from a Contact by slug
export async function detachContactTag(
  userId: string,
  contactId: string,
  slug: string
): Promise<void> {
  const clean = slugifyTag(slug);
  if (!clean) return;

  const tag = await prisma.tag.findFirst({
    where: { userId, slug: clean },
    select: { id: true }
  });
  if (!tag) return;

  await prisma.contactTag.deleteMany({
    where: { contactId, tagId: tag.id }
  });

  if (DEBUG_TAGS) console.log('[tags] detachContactTag done', { contactId, slug: clean });
}
