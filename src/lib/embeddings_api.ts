// src/lib/embeddings_api.ts
// PURPOSE: Create embedding vectors for text that match your pgvector column size.
// USAGE: import { createEmbeddingForText } from '$lib/embeddings_api'
// REQS: Set OPENAI_API_KEY in your .env
// NOTES:
// - Returns number[] suitable for writing as a pgvector literal like [a,b,c]
// - Model dim must match your DB column size

import OpenAI from 'openai';

// IT: never hardcode secrets - read from env
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// IT: choose a stable model and keep DB column dim in sync
// text-embedding-3-small produces 1536 dimensional vectors
const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function createEmbeddingForText(text: string): Promise<number[]> {
  // IT: normalize and short circuit on empty
  const input = (text || '').trim();
  if (!input) return [];

  // IT: call OpenAI Embeddings API
  const resp = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input
  });

  // IT: extract first embedding and coerce to number[]
  const vec = resp.data?.[0]?.embedding ?? [];
  return Array.isArray(vec) ? vec.map((v) => Number(v)) : [];
}
