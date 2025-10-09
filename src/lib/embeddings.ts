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
