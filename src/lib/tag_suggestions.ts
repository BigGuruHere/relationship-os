// src/lib/tag_suggestions.ts
// PURPOSE: Suggest existing tags for an interaction using pgvector cosine ranking.
// SCOPE: tenant scoped by userId. Returns suggestions only - no persistence.
// NOTES:
// - Requires InteractionEmbedding.vec and Tag.embedding_vec to be present
// - Score is 1 - cosine_distance so it falls in [0,1] where higher is better
// - All IT code is commented

// IT: Central defaults for automatic tag suggestions.
// Increase DEFAULT_TAG_MIN_SCORE to make suggested tags stricter.
// Decrease it to allow looser semantic matches.
export const DEFAULT_TAG_MIN_SCORE = 0.4;

// IT: Maximum number of suggested tags returned from semantic matching.
// Lower this if the app suggests too many tags.
export const DEFAULT_TAG_SUGGESTION_LIMIT = 4;

import { prisma } from '$lib/db';
import { contextSpaceIdForOwner } from '$lib/server/core/contextSpace';

export type TagSuggestion = {
  id: string;
  name: string;
  score: number; // 0..1 where 1 is most similar
};

type Params = {
  userId: string;
  interactionId: string;
  topK?: number;
  minScore?: number;
};
export async function suggestTagsForInteraction({
  userId,
  interactionId,
  // IT: Use the central app-wide tag suggestion limit by default.
  topK = DEFAULT_TAG_SUGGESTION_LIMIT,
  // IT: Use the central app-wide semantic threshold by default.
  minScore = DEFAULT_TAG_MIN_SCORE
}: Params): Promise<TagSuggestion[]> {
  // IT: guard inputs
  if (!userId || !interactionId) return [];
  const contextSpaceId = contextSpaceIdForOwner(userId);

  // IT: SQL plan
  // 1) Pull the interaction vector for this interaction and user
  // 2) Rank this tenant's tags by cosine distance using pgvector operator
  // 3) Convert distance to similarity = 1 - distance
  // 4) Filter by minScore and limit to topK
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; score: number }>
  >(
    `
    WITH q AS (
      SELECT ie."vec" AS v
      FROM "InteractionEmbedding" ie
      JOIN "Interaction" i ON i."id" = ie."interactionId"
      WHERE ie."interactionId" = $1
        AND i."userId" = $2
        AND i."contextSpaceId" = $3
        AND ie."vec" IS NOT NULL
      LIMIT 1
    )
    SELECT t."id",
           t."name",
           GREATEST(0, LEAST(1, 1 - (t."embedding_vec" <=> q.v))) AS score
    FROM "Tag" t, q
    WHERE t."userId" = $2
      AND t."contextSpaceId" = $3
      AND t."embedding_vec" IS NOT NULL
    ORDER BY score DESC
    LIMIT $4
    `,
    interactionId,
    userId,
    contextSpaceId,
    Math.max(1, topK)
  );

  // IT: apply minScore in JS as a safety net and return clean objects
  return (rows ?? []).filter(r => r.score >= minScore).map(r => ({
    id: r.id,
    name: r.name,
    score: Number(r.score)
  }));
}
