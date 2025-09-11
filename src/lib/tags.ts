// src/lib/tags.ts
// PURPOSE: normalize tags, resolve to Tag or TagAlias, attach to Interaction or Contact.
// SECURITY: do not log plaintext user content.

import { prisma } from '$lib/db';

const TAG_SLUG_RE = /[^a-z0-9]+/g;

// Slugify a human tag to a stable machine slug
export function slugifyTag(input: string) {
  return input.trim().toLowerCase().replace(TAG_SLUG_RE, '-').replace(/^-+|-+$/g, '');
}

// Resolve or create Tags for an array of candidate names
async function resolveOrCreateTags(
  names: string[],
  createdBy: 'ai' | 'user'
): Promise<{ id: string; slug: string }[]> {
  const slugs = Array.from(new Set(names.map(slugifyTag).filter((s) => s.length >= 2 && s.length <= 24)));
  if (slugs.length === 0) return [];

  // Find existing by slug or alias
  const existing = await prisma.tag.findMany({
    where: { OR: [{ slug: { in: slugs } }, { aliases: { some: { slug: { in: slugs } } } }] },
    select: { id: true, slug: true }
  });

  const found = new Set(existing.map((t) => t.slug));
  const missing = slugs.filter((s) => !found.has(s));

  // Create any missing tags
  const created = await prisma.$transaction(
    missing.map((slug) => prisma.tag.create({ data: { name: slug, slug, createdBy } }))
  );

  return [...existing, ...created];
}

// Attach tags to an Interaction by id
export async function attachInteractionTags(
  interactionId: string,
  candidates: string[],
  assignedBy: 'ai' | 'user' = 'ai'
) {
  const tags = await resolveOrCreateTags(candidates, assignedBy);
  if (tags.length === 0) return;

  await prisma.$transaction(
    tags.map((t) =>
      prisma.interactionTag.upsert({
        where: { interactionId_tagId: { interactionId, tagId: t.id } },
        update: {},
        create: { interactionId, tagId: t.id, assignedBy }
      })
    )
  );
}

// Attach tags to a Contact by id
export async function attachContactTags(
  contactId: string,
  candidates: string[],
  assignedBy: 'ai' | 'user' = 'user'
) {
  const tags = await resolveOrCreateTags(candidates, assignedBy);
  if (tags.length === 0) return;

  await prisma.$transaction(
    tags.map((t) =>
      prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId, tagId: t.id } },
        update: {},
        create: { contactId, tagId: t.id, assignedBy }
      })
    )
  );
}

// Detach a single tag from a Contact by slug
export async function detachContactTag(contactId: string, slug: string) {
  const tag = await prisma.tag.findUnique({ where: { slug }, select: { id: true } });
  if (!tag) return;
  await prisma.contactTag.deleteMany({ where: { contactId, tagId: tag.id } });
}

// Detach a single tag from an Interaction by slug
export async function detachInteractionTag(interactionId: string, slug: string) {
  const tag = await prisma.tag.findUnique({ where: { slug }, select: { id: true } });
  if (!tag) return;
  await prisma.interactionTag.deleteMany({ where: { interactionId, tagId: tag.id } });
}
