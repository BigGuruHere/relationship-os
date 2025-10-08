// src/lib/tag_suggestions.ts
// PURPOSE: suggest existing user-created tags for a given embedding vector
// NOTES:
// - Uses pgvector distance on Tag.embedding_vec only
// - Every query is tenant scoped by userId
// - All IT code is commented and uses hyphens instead of em dashes

import { prisma } from '$lib/db';

/** Convert a JS number[] to a pgvector text literal like [0.1,-0.2,0.3] */
function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

export type TagSuggestion = {
  id: string;
  name: string;
  distance: number; // smaller is better
  score: number;    // convenience score 1 - distance for UI
};

export async function suggestTagsForVector(
  userId: string,
  queryVec: number[],
  topK = 8,
  minScore = 0.32 // tune as you like
): Promise<TagSuggestion[]> {
  const v = toPgVectorLiteral(queryVec);

  // IT: rank by pgvector cosine distance - lower distance is more similar
  const rows = await prisma.$queryRawUnsafe<
    { id: string; name: string; distance: number }[]
  >(
    `
    SELECT t."id", t."name",
           (t."embedding_vec" <-> $1::vector) AS distance
    FROM "Tag" t
    WHERE t."userId" = $2
      AND t."embedding_vec" IS NOT NULL
    ORDER BY distance ASC
    LIMIT $3
    `,
    v,
    userId,
    topK
  );

  // IT: convert to a simple score for UI filtering
  return rows
    .map(r => ({ ...r, score: 1 - r.distance }))
    .filter(r => r.score >= minScore);
}
