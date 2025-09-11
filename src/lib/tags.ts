// src/lib/tags.ts
// PURPOSE: Normalize candidate tags, resolve to Tag/TagAlias, attach to Interaction.

import { prisma } from "$lib/db";

const TAG_SLUG_RE = /[^a-z0-9]+/g;

export function slugifyTag(input: string) {
  return input.trim().toLowerCase().replace(TAG_SLUG_RE, "-").replace(/^-+|-+$/g, "");
}

export async function attachInteractionTags(
  interactionId: string,
  candidates: string[],
  assignedBy: "ai" | "user" = "ai"
) {
  const slugs = Array.from(
    new Set(
      candidates.map(slugifyTag).filter((s) => s.length >= 2 && s.length <= 24)
    )
  );
  if (slugs.length === 0) return;

  // Find existing tags
  const existing = await prisma.tag.findMany({
    where: {
      OR: [{ slug: { in: slugs } }, { aliases: { some: { slug: { in: slugs } } } }],
    },
    select: { id: true, slug: true },
  });

  const found = new Set(existing.map((t) => t.slug));
  const missing = slugs.filter((s) => !found.has(s));

  // Create missing tags
  const created = await prisma.$transaction(
    missing.map((slug) =>
      prisma.tag.create({ data: { name: slug, slug, createdBy: assignedBy } })
    )
  );

  const all = [...existing, ...created];

  // Attach to interaction
  await prisma.$transaction(
    all.map((t) =>
      prisma.interactionTag.upsert({
        where: { interactionId_tagId: { interactionId, tagId: t.id } },
        update: {},
        create: { interactionId, tagId: t.id, assignedBy },
      })
    )
  );
}
