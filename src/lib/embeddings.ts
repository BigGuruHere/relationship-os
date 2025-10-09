// IT: embeddings.ts
// PURPOSE: Compute an embedding and upsert it into InteractionEmbedding.vec using pgvector.
// NOTE: Prisma has no native vector type, so we use raw SQL and the Unsupported("vector") field.
// SAFETY: Single INSERT ... ON CONFLICT keeps it idempotent. Tenant scoped by userId.

import { prisma } from '$lib/db';
import { createEmbeddingForText } from '$lib/embeddings_api'; // IT: your existing OpenAI helper

/** IT: Convert number[] to a pgvector text literal like [0.12,-0.3,1.0] */
function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

/**
 * IT: Compute and store the interaction embedding vector.
 * - Computes from plaintext
 * - Writes to InteractionEmbedding.vec using INSERT ... ON CONFLICT
 */
export async function upsertInteractionEmbedding(
  userId: string,
  interactionId: string,
  plaintext: string
): Promise<void> {
  // IT: guard empty input
  const text = (plaintext || '').trim();
  if (!text) return;

  // IT: call your embedding provider and get a number[] of length 1536
  const vec = await createEmbeddingForText(text);
  if (!Array.isArray(vec) || vec.length === 0) return;

  // IT: prepare pgvector literal. Cast uses lowercase ::vector
  const literal = toPgVectorLiteral(vec);

  // IT: create row if missing, update vec if present - tenant scoped on (userId, interactionId)
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "InteractionEmbedding" ("interactionId")
    VALUES ($1)
    ON CONFLICT ("interactionId") DO NOTHING
    `,
    interactionId
  );

  await prisma.$executeRawUnsafe(
    `
    UPDATE "InteractionEmbedding"
    SET "vec" = $1::vector
    WHERE "interactionId" = $2
    `,
    literal,
    interactionId
  );
}

// IT: semanticSearchInteractions - rank this tenant's notes by similarity to a query
// - Computes an embedding for the query text
// - Uses pgvector cosine distance against InteractionEmbedding.vec
// - Returns top matches with scores in 0..1 where 1 is most similar
export async function semanticSearchInteractions(params: {
  userId: string;
  query: string;
  topK?: number;
  minScore?: number;
}): Promise<Array<{ interactionId: string; score: number }>> {
  const { userId } = params;
  const query = (params.query || '').trim();
  const topK = Math.max(1, params.topK ?? 20);
  const minScore = params.minScore ?? 0.2;

  // IT: short circuit on empty query
  if (!userId || !query) return [];

  // IT: embed the query
  const qvec = await createEmbeddingForText(query);
  if (!Array.isArray(qvec) || qvec.length === 0) return [];

  // IT: convert to pgvector literal and run the search
  const literal = `[${qvec.join(',')}]`;

  // IT: join InteractionEmbedding to Interaction to enforce tenant scoping by userId
  // - distance operator <=> gives cosine distance in 0..2 for normalized vectors, we bound to [0,1] via 1 - distance
  const rows = await prisma.$queryRawUnsafe<
    Array<{ interactionId: string; score: number }>
  >(
    `
    SELECT ie."interactionId",
           GREATEST(0, LEAST(1, 1 - (ie."vec" <=> $1::vector))) AS score
    FROM "InteractionEmbedding" ie
    JOIN "Interaction" i ON i."id" = ie."interactionId"
    WHERE i."userId" = $2
      AND ie."vec" IS NOT NULL
    ORDER BY ie."vec" <=> $1::vector ASC
    LIMIT $3
    `,
    literal,
    userId,
    topK
  );

  // IT: apply minScore guard in JS and return clean array
  return (rows ?? []).filter(r => Number(r.score) >= minScore).map(r => ({
    interactionId: r.interactionId,
    score: Number(r.score)
  }));
}

