// src/lib/embeddings.ts
// PURPOSE: Create and query embeddings for semantic recall using a separate table.
// STORAGE: InteractionEmbedding(interactionId pk, embedding vector(1536))

import { prisma } from '$lib/db';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not set. Embedding calls will fail.');
}

// Call OpenAI JSON REST
async function openaiJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

function normalizeForEmbedding(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export async function embedText(text: string): Promise<number[]> {
  const prompt = normalizeForEmbedding(text);
  type EmbResp = { data: { embedding: number[] }[] };
  const resp = await openaiJson<EmbResp>('/embeddings', {
    model: EMBEDDING_MODEL,
    input: prompt
  });
  const vec = resp.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== 1536) throw new Error('Unexpected embedding shape');
  return vec;
}

// Convert vector to a safe SQL literal
function toVectorLiteral(vec: number[], dims: number): string {
  if (vec.length !== dims) throw new Error(`Embedding length ${vec.length} does not match ${dims}`);
  const numbers = vec.map((v) => (Number.isFinite(v) ? Number(v).toFixed(6) : '0'));
  return `'[${numbers.join(',')}]'::vector(${dims})`;
}

// Build text to embed from summary and raw note
export function buildInteractionEmbeddingText(args: { summary?: string | null; raw: string }) {
  const parts: string[] = [];
  if (args.summary && args.summary.trim()) parts.push(args.summary.trim());
  const tail = args.raw.trim().slice(0, 800);
  if (tail) parts.push(tail);
  return parts.join('\n\n');
}

// Insert or update into InteractionEmbedding
export async function upsertInteractionEmbedding(interactionId: string, summary: string | null, raw: string) {
  const text = buildInteractionEmbeddingText({ summary, raw });
  if (!text) return;

  const vec = await embedText(text);
  const literal = toVectorLiteral(vec, 1536);

  // Use upsert pattern with raw SQL for pgvector literal
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "InteractionEmbedding" ("interactionId", "embedding")
    VALUES ($1, ${literal})
    ON CONFLICT ("interactionId")
    DO UPDATE SET "embedding" = ${literal}
    `,
    interactionId
  );
}

// Vector search across interactions
export async function semanticSearchInteractions(query: string, limit = 10) {
  const vec = await embedText(query);
  const literal = toVectorLiteral(vec, 1536);

  type Row = {
    id: string;
    contactId: string;
    occurredAt: Date;
    channel: string;
    score: number;
  };

  // Join InteractionEmbedding for the vector and return interaction metadata
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `
    SELECT i."id",
           i."contactId",
           i."occurredAt",
           i."channel",
           (ie."embedding" <-> ${literal}) AS score
    FROM "InteractionEmbedding" ie
    JOIN "Interaction" i ON i."id" = ie."interactionId"
    ORDER BY ie."embedding" <-> ${literal}
    LIMIT $1
    `,
    limit
  );

  return rows;
}
