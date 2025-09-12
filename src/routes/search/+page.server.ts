// PURPOSE: Server-side search using embeddings. Decrypts contact names for display.
// INPUT: query string param q=... or form POST with q
// OUTPUT: top interactions with contact name, date, channel, summary, tags

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { semanticSearchInteractions } from '$lib/embeddings';
import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';


export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return { q: '', results: [] };

  // 1) vector search to get candidates
  const hits = await semanticSearchInteractions(q, 12);

  if (hits.length === 0) return { q, results: [] };

  // 2) fetch metadata and decrypt for display
  const ids = hits.map((h) => h.id);
  const rows = await prisma.interaction.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, contactId: true, occurredAt: true, channel: true, summaryEnc: true,
      contact: {
        select: { id: true, fullNameEnc: true }
      },
      tags: {
        select: { tag: { select: { name: true, slug: true } } }
      }
    }
  });

  // 3) index hits by id to keep score
  const scoreMap = new Map(hits.map((h) => [h.id, h.score]));

  // 4) shape results for UI, decrypt fields
  const results = rows.map((r) => {
    let name = 'Unknown';
    try { name = decrypt(r.contact.fullNameEnc, 'contact.full_name'); } catch {}
    let summary: string | null = null;
    try { summary = r.summaryEnc ? decrypt(r.summaryEnc, 'interaction.summary') : null; } catch { summary = null; }
    const tags = r.tags.map((t) => t.tag);
    return {
      id: r.id,
      contactId: r.contactId,
      contactName: name,
      occurredAt: r.occurredAt,
      channel: r.channel,
      summary,
      tags,
      score: scoreMap.get(r.id) ?? 1.0
    };
  }).sort((a, b) => a.score - b.score); // lower is better for cosine distance

  return { q, results };
};

export const actions = {
    search: async ({ request }) => {
      const form = await request.formData();
      const q = String(form.get('q') || '').trim();
      throw redirect(303, `/search?q=${encodeURIComponent(q)}`);
    }
  };
