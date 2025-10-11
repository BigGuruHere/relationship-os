// src/routes/api/summarize/+server.ts
// PURPOSE: Summarize note text and suggest tags from the existing Tag list.
// INPUT:
// - { text: string }  - preferred for new notes before save
// - or { interactionId: string } - will decrypt the note on the server
// OUTPUT:
// - { summary: string, suggestedTags: Array<{ id: string; name: string; score: number }> }
//
// SECURITY: Requires login. All queries are tenant scoped by userId.
// NOTES: Uses pgvector to rank Tag.embedding_vec against a fresh embedding of the input text.

import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { summarizeText } from '$lib/ai';
import { createEmbeddingForText } from '$lib/embeddings_api';

// helper - vector literal for pgvector
function toVecLiteral(vec: number[]) {
  return `[${vec.join(',')}]`;
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  // parse body
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const interactionId = String(body.interactionId || '').trim();
  const textIn = String(body.text || '').trim();

  // get plaintext - prefer provided text since new note is not saved yet
  let plaintext = textIn;

  if (!plaintext && interactionId) {
    // fetch and decrypt the interaction text if an id is provided
    const row = await prisma.interaction.findFirst({
      where: { id: interactionId, userId: locals.user.id },
      select: { rawTextEnc: true }
    });
    if (!row) return json({ error: 'Interaction not found' }, { status: 404 });

    try {
      plaintext = row.rawTextEnc ? decrypt(row.rawTextEnc, 'interaction.raw_text') : '';
    } catch {
      plaintext = '';
    }
  }

  if (!plaintext) {
    return json({ error: 'No text to summarize' }, { status: 400 });
  }

  // create the summary
  const rawSummary = await summarizeText(plaintext);
  const summary =
  typeof rawSummary === 'string'
  ? rawSummary
  : (rawSummary && typeof (rawSummary as any).summary === 'string'
  ? (rawSummary as any).summary
  : '');
  
  // build tag suggestions by embedding the text and ranking tenant tags
  let suggestedTags: Array<{ id: string; name: string; score: number }> = [];
  try {
    const q = await createEmbeddingForText(plaintext);
    if (Array.isArray(q) && q.length > 0) {
      const literal = toVecLiteral(q);
      const rows = await prisma.$queryRawUnsafe<
        Array<{ id: string; name: string; score: number }>
      >(
        `
        SELECT t."id",
               t."name",
               GREATEST(0, LEAST(1, 1 - (t."embedding_vec" <=> $1::vector))) AS score
        FROM "Tag" t
        WHERE t."userId" = $2
          AND t."embedding_vec" IS NOT NULL
        ORDER BY t."embedding_vec" <=> $1::vector ASC
        LIMIT 8
        `,
        literal,
        locals.user.id
      );

      const MIN = typeof body.minScore === 'number' ? Number(body.minScore) : 0.25;
      suggestedTags = (rows || [])
        .filter(r => Number(r.score) >= MIN)
        .map(r => ({ id: r.id, name: r.name, score: Number(r.score) }));
    }
  } catch {
    // best effort - suggestions can be empty
  }
  const tagsList = suggestedTags.map(t => t.name);

  return json({ summary, suggestedTags, tags: tagsList });
};
