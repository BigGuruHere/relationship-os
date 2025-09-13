// src/lib/embeddings.ts
// PURPOSE: Generate and upsert embeddings for interactions using OpenAI.
// MULTI TENANT: Verifies the interaction belongs to the user before writing.
// STORAGE: Prisma maps number[] to Postgres double precision[].
// All IT code is commented and uses hyphens only.

import { prisma } from '$lib/db';

// Comment: keep the model configurable via env with a sensible default.
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Generate an embedding vector for a text using OpenAI's embeddings API.
 * - Returns a number array or null if the call fails.
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  // Guardrails - skip empty text or missing API key.
  const input = (text || '').trim();
  if (!input || !OPENAI_API_KEY) return null;

  // Trim very long inputs to keep request size reasonable.
  const MAX_CHARS = 8000;
  const toEmbed = input.length > MAX_CHARS ? input.slice(0, MAX_CHARS) : input;

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: toEmbed
    })
  });

  if (!res.ok) {
    // Non fatal - let caller continue without embeddings.
    const body = await res.text().catch(() => '');
    console.error('Embedding request failed:', res.status, body.slice(0, 200));
    return null;
  }

  const json = (await res.json().catch(() => null)) as any;
  const vec = json?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) return null;

  // Ensure numbers - filter out any non numeric values defensively.
  return vec.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v));
}

/**
 * Upsert the embedding row for an interaction.
 * - Verifies the interaction belongs to the given user id.
 * - Creates or replaces the InteractionEmbedding record.
 */
export async function upsertInteractionEmbedding(
  userId: string,
  interactionId: string,
  plaintext: string
): Promise<void> {
  // Verify tenant ownership first.
  const exists = await prisma.interaction.findFirst({
    where: { id: interactionId, userId },
    select: { id: true }
  });
  if (!exists) {
    console.warn('upsertInteractionEmbedding - interaction not in tenant:', interactionId);
    return;
  }

  // Generate the embedding - skip if the call fails.
  const embedding = await generateEmbedding(plaintext);
  if (!embedding || embedding.length === 0) return;

  // InteractionEmbedding has a PK of interactionId.
  await prisma.interactionEmbedding.upsert({
    where: { interactionId },
    update: { embedding },
    create: { interactionId, embedding }
  });
}
