// src/lib/embeddings.ts
// PURPOSE: Embeddings stored as Postgres double precision[] and ranked via cosine_similarity() SQL.
// PORTABLE: No pgvector extension required.

import { prisma } from '$lib/db';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims
const TIMEOUT_MS = 12000;

// Call OpenAI JSON REST with a timeout
async function openaiJson<T>(path: string, body: unknown): Promise<T> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing');

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`https://api.openai.com/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI ${path} ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(t);
  }
}

// Normalize to keep token count in check
function normalizeForEmbedding(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

// Build the text to embed for an interaction
export function buildInteractionEmbeddingText(args: { summary?: string | null; raw: string }) {
  const parts: string[] = [];
  if (args.summary && args.summary.trim()) parts.push(args.summary.trim());
  const tail = args.raw.trim().slice(0, 800);
  if (tail) parts.push(tail);
  return parts.join('\n\n');
}

// Create a 1536 vector as number[]
export async function embedText(text: string): Promise<number[]> {
  const prompt = normalizeForEmbedding(text);
  type EmbResp = { data: { embedding: number[] }[] };
  const resp = await openaiJson<EmbResp>('/embeddings', {
    model: EMBEDDING_MODEL,
    input: prompt
  });
  const vec = resp.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== 1536) {
    throw new Error('Unexpected embedding shape');
  }
  return vec;
}

// PURPOSE: compute embedding and store it using a raw SQL upsert
// - avoids Prisma upsert on a model that may be out of sync
// - writes to InteractionEmbedding(interactionId text, embedding float8[])

export async function upsertInteractionEmbedding(interactionId: string, summary: string | null, raw: string) {
    // Build the text we want to embed
    const text = buildInteractionEmbeddingText({ summary, raw });
    if (!text) return;
  
    // Call OpenAI to get a 1536-d vector
    const vec = await embedText(text);
  
    // Build a Postgres ARRAY[...] literal with double precision numbers
    // We keep 6 decimal places for compactness
    const numbers = vec.map((v) => (Number.isFinite(v) ? Number(v).toFixed(6) : '0'));
    const arrLiteral = `ARRAY[${numbers.join(',')}]::double precision[]`;
  
    // Upsert using raw SQL so we do not rely on Prisma's CRUD model generation
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "InteractionEmbedding" ("interactionId", "embedding")
      VALUES ($1, ${arrLiteral})
      ON CONFLICT ("interactionId")
      DO UPDATE SET "embedding" = EXCLUDED."embedding"
      `,
      interactionId
    );
  }
  

// Semantic search using cosine_similarity function from migration
export async function semanticSearchInteractions(query: string, limit = 10) {
  const vec = await embedText(query);

  // Build ARRAY literal for double precision[]
  const numbers = vec.map((v) => (Number.isFinite(v) ? Number(v).toFixed(6) : '0'));
  const arrLiteral = `ARRAY[${numbers.join(',')}]::double precision[]`;

  type Row = {
    id: string;
    contactId: string;
    occurredAt: Date;
    channel: string;
    score: number;
  };

  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `
    SELECT i."id",
           i."contactId",
           i."occurredAt",
           i."channel",
           cosine_similarity(ie."embedding", ${arrLiteral}) AS score
    FROM "InteractionEmbedding" ie
    JOIN "Interaction" i ON i."id" = ie."interactionId"
    ORDER BY score DESC
    LIMIT $1
    `,
    limit
  );

  return rows;
}
