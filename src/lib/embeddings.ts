// src/lib/embeddings.ts
// PURPOSE: OpenAI embedding helpers - generate vectors, upsert interaction embeddings,
//          and perform semantic search over interactions.
// MULTI TENANT: All reads and writes are scoped by userId.
// STORAGE: Prisma maps number[] to Postgres double precision[] (no pgvector).
// SECURITY: Never log decrypted plaintext. Only short previews. All IT code is commented and uses hyphens only.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';

// Configurable model via env with a sensible default.
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Generate an embedding vector for a text via OpenAI embeddings API.
 * - Returns a number[] or null if the call fails or is not configured.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const input = (text || '').trim();
  if (!input || !OPENAI_API_KEY) return null;

  // Trim extremely long inputs to keep request size reasonable.
  const MAX_CHARS = 8000;
  const toEmbed = input.length > MAX_CHARS ? input.slice(0, MAX_CHARS) : input;

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: toEmbed })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Embedding request failed:', res.status, body.slice(0, 200));
    return null;
  }

  const json = (await res.json().catch(() => null)) as any;
  const vec = json?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) return null;

  // Ensure numbers only.
  return vec.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v));
}

/**
 * Upsert the embedding row for an interaction.
 * - Verifies the interaction belongs to this tenant before writing.
 * - Creates or replaces the InteractionEmbedding record keyed by interactionId.
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

  const embedding = await generateEmbedding(plaintext);
  if (!embedding || embedding.length === 0) return;

  await prisma.interactionEmbedding.upsert({
    where: { interactionId },
    update: { embedding },
    create: { interactionId, embedding }
  });
}

// Small helper to build a safe preview for UI lists.
function preview(text: string, max = 280): string {
  const t = (text || '').trim();
  return t.length > max ? t.slice(0, max - 3) + '...' : t;
}

/**
 * Semantic search interactions for a tenant.
 * - Computes a query embedding, ranks interactions with cosine similarity over float8[].
 * - Returns decrypted previews with scores, newest first among ties.
 * - Resilient to NULL scores by coalescing to -1 so rows still appear.
 */
export async function semanticSearchInteractions(
  userId: string,
  query: string,
  opts: { limit?: number; minScore?: number } = {}
): Promise<
  Array<{
    id: string;
    contactId: string;
    contactName: string;
    channel: string;
    occurredAt: Date | null;
    score: number;
    preview: string;
  }>
> {
  const qVec = await generateEmbedding(query);
  if (!qVec || qVec.length === 0) {
    // Caller can surface a friendly message like "Check OPENAI_API_KEY or network".
    return [];
  }

  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  // Keep all results by default - caller can choose to hide very low scores if desired.
  const minScore = typeof opts.minScore === 'number' ? opts.minScore : -1;

  // Use Prisma's quoted table and camelCase column names exactly as created by the schema.
  type Row = {
    id: string;
    contactId: string;
    channel: string;
    occurredAt: Date | null;
    rawTextEnc: string;
    contactNameEnc: string;
    score: number | null;
    dim: number | null;
  };

  let rows: Row[] = [];
  try {
    rows = await prisma.$queryRaw<Row[]>`
      SELECT
        i.id,
        i."contactId"   AS "contactId",
        i.channel       AS "channel",
        i."occurredAt"  AS "occurredAt",
        i."rawTextEnc"  AS "rawTextEnc",
        c."fullNameEnc" AS "contactNameEnc",
        COALESCE(public.cosine_similarity(ie."embedding", ${qVec}::double precision[]), -1) AS score,
        array_length(ie."embedding", 1) AS dim
      FROM "Interaction" i
      JOIN "InteractionEmbedding" ie ON ie."interactionId" = i.id
      JOIN "Contact" c ON c.id = i."contactId"
      WHERE i."userId" = ${userId}
      ORDER BY score DESC, COALESCE(i."occurredAt", i."createdAt") DESC, i.id DESC
      LIMIT ${limit}
    `;
  } catch (err) {
    console.error('semanticSearchInteractions query failed:', err);
    return [];
  }

  const out = [];
  for (const r of rows) {
    // If a caller set minScore, honor it - default includes everything.
    if (minScore > -1 && !(Number(r.score ?? -1) >= minScore)) continue;

    let text = '';
    let name = '';
    try {
      text = r.rawTextEnc ? decrypt(r.rawTextEnc, 'interaction.raw_text') : '';
    } catch {}
    try {
      name = r.contactNameEnc ? decrypt(r.contactNameEnc, 'contact.full_name') : '';
    } catch {}

    out.push({
      id: r.id,
      contactId: r.contactId,
      contactName: name || '(unknown)',
      channel: r.channel,
      occurredAt: r.occurredAt,
      score: Number(r.score ?? -1),
      preview: preview(text)
    });
  }

  return out;
}
