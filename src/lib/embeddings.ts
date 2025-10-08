// src/lib/embeddings.ts
// PURPOSE: embedding helpers for saving and searching interaction embeddings
// NOTES:
// - Dual write: keep Float[] as the baseline and also write pgvector columns
// - Read path prefers pgvector distance with a Float[] cosine fallback
// - Every query is tenant scoped by userId via an inner join to Interaction
// - All IT code is commented and uses hyphens instead of em dashes

import { prisma } from '$lib/db';

/**
 * Create an OpenAI embedding from text.
 * Replace this with your actual call inside $lib/ai.ts if you centralize model access.
 */
export async function createEmbeddingForText(text: string): Promise<number[]> {
  // IT: this is a stub - call your real embeddings API and return a plain number[]
  // Example shape:
  // const res = await openai.embeddings.create({ ... });
  // return res.data[0].embedding as number[];
  throw new Error('createEmbeddingForText is not implemented here - wire to your AI client');
}

// IT: Convert number[] to a pgvector text literal like [0.12,-0.3,1.0]
function toPgvectorLiteral(vec: number[]): string {
  // IT: pgvector accepts bracketed comma-separated lists when bound as text
  return `[${vec.join(',')}]`;
}

/** Convert a JS number[] to a Postgres float8[] literal like {0.12,-0.3,1.0} */
function toFloat8ArrayLiteral(vec: number[]): string {
  return `{${vec.join(',')}}`;
}

/**
 * Upsert an interaction embedding - dual write to Float[] and pgvector.
 * - Float[] goes into InteractionEmbedding.embedding via Prisma
 * - pgvector goes into InteractionEmbedding.vec via raw SQL
 * - Tenant scoping is enforced on the read path - for writes we use the parent id
 */
export async function upsertInteractionEmbedding(
  interactionId: string,
  embedding: number[]
): Promise<void> {
  // IT: write the Float[] using Prisma - this creates or updates the row
  await prisma.interactionEmbedding.upsert({
    where: { interactionId },
    create: {
      interactionId,
      embedding, // Float[] column
    },
    update: {
      embedding, // keep Float[] in sync on updates
    },
  });

  // IT: also write the pgvector column using a safe parameterized raw SQL
  const vectorLiteral = toPgvectorLiteral(embedding);
  await prisma.$executeRawUnsafe(
    `
      UPDATE "InteractionEmbedding"
      SET "vec" = $1::vector
      WHERE "interactionId" = $2
    `,
    vectorLiteral,
    interactionId
  );
}

/**
 * Find similar interactions for a user - prefers pgvector, falls back to Float[] cosine.
 * Returns interaction ids with a score in [0,1] where higher is more similar.
 */
export async function searchSimilarInteractions(
  userId: string,
  queryVec: number[],
  opts?: { topK?: number; minScore?: number }
): Promise<Array<{ interactionId: string; score: number }>> {
  const topK = opts?.topK ?? 20;
  const minScore = opts?.minScore ?? 0.3;

  // IT: first try pgvector if there are any rows with a non null vec for this user
  const vectorLiteral = toPgvectorLiteral(queryVec);

  // IT: try to rank by pgvector distance - lower distance is closer
  const byPgvector = await prisma.$queryRawUnsafe<
    Array<{ interactionId: string; distance: number }>
  >(
    `
      SELECT ie."interactionId",
             (ie."vec" <-> $1::vector) AS distance
      FROM "InteractionEmbedding" ie
      INNER JOIN "Interaction" i ON i."id" = ie."interactionId"
      WHERE i."userId" = $2
        AND ie."vec" IS NOT NULL
      ORDER BY distance ASC
      LIMIT $3
    `,
    vectorLiteral,
    userId,
    topK
  );

  if (byPgvector.length > 0) {
    // IT: convert cosine distance to a pseudo score - this is 1 - distance
    // For cosine, distances are usually in [0,2] if not normalized - with 0 best
    // If your vectors are unit normalized, distance is in [0,2] and 1 - d is a simple monotone map
    const ranked = byPgvector
      .map(r => ({ interactionId: r.interactionId, score: 1 - r.distance }))
      .filter(r => r.score >= minScore);
    if (ranked.length > 0) return ranked;
  }

  // IT: fallback to Float[] cosine_similarity
  const float8 = toFloat8ArrayLiteral(queryVec);
  const byArrays = await prisma.$queryRawUnsafe<
    Array<{ interactionId: string; score: number | null }>
  >(
    `
      SELECT ie."interactionId",
             cosine_similarity(ie."embedding", $1::float8[]) AS score
      FROM "InteractionEmbedding" ie
      INNER JOIN "Interaction" i ON i."id" = ie."interactionId"
      WHERE i."userId" = $2
        AND cardinality(ie."embedding") > 0
      ORDER BY score DESC NULLS LAST
      LIMIT $3
    `,
    float8,
    userId,
    topK
  );

  return byArrays
    .filter(r => r.score !== null && r.score >= minScore)
    .map(r => ({ interactionId: r.interactionId, score: r.score as number }));
}

/**
 * Convenience - compute and save an embedding for a block of text tied to an interaction.
 * - Calls your embedding provider
 * - Saves Float[] and pgvector
 */
export async function embedInteractionText(
  interactionId: string,
  rawText: string
): Promise<number[]> {
  const vec = await createEmbeddingForText(rawText);
  await upsertInteractionEmbedding(interactionId, vec);
  return vec;
}
