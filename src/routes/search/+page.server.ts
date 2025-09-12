// src/routes/search/+page.server.ts
// PURPOSE: Semantic search results for interactions (notes) with decrypted contact names
// NOTES:
// - Keeps the ranking from semanticSearchInteractions (highest score first)
// - Falls back to client-side DESC sort by score if needed
// - Secondary tie-breaker by occurredAt DESC

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { semanticSearchInteractions } from '$lib/embeddings';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return { q: '', results: [], error: null };

  try {
    // 1) Get ranked hits from vector search (should already be DESC by similarity)
    const hits = await semanticSearchInteractions(q, 12);
    if (hits.length === 0) return { q, results: [], error: null };

    // Build lookups to preserve order and scores
    const ids = hits.map((h) => h.id);
    const rank = new Map<string, number>(hits.map((h, i) => [h.id, i])); // lower i means higher rank
    const scoreMap = new Map<string, number>(hits.map((h) => [h.id, h.score]));

    // 2) Fetch interaction metadata for those ids
    const rows = await prisma.interaction.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        contactId: true,
        occurredAt: true,
        channel: true,
        summaryEnc: true,
        contact: { select: { id: true, fullNameEnc: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } }
      }
    });

    // 3) Shape results, decrypt fields, attach score
    const shaped = rows.map((r) => {
      let name = 'Unknown';
      try { name = decrypt(r.contact.fullNameEnc, 'contact.full_name'); } catch {}
      let summary: string | null = null;
      try { summary = r.summaryEnc ? decrypt(r.summaryEnc, 'interaction.summary') : null; } catch { summary = null; }
      return {
        id: r.id,
        contactId: r.contactId,
        contactName: name,
        occurredAt: r.occurredAt,
        channel: r.channel,
        summary,
        tags: r.tags.map((t) => t.tag),
        score: scoreMap.get(r.id) ?? 0,
        rnk: rank.get(r.id) ?? Number.MAX_SAFE_INTEGER
      };
    });

    // 4) Sort to ensure DESC by score, with a stable tie-break by occurredAt DESC
    // You can also preserve original vector order exactly by sorting on rnk only.
    const results = shaped.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score; // DESC score
      if (a.rnk !== b.rnk) return a.rnk - b.rnk;         // preserve vector order when scores equal
      return +new Date(b.occurredAt) - +new Date(a.occurredAt); // tie-break by recency
    });

    return { q, results, error: null };
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Search service error';
    return { q, results: [], error: msg };
  }
};

export const actions: Actions = {
  // POST from the search form redirects to GET so the URL is shareable
  search: async ({ request }) => {
    const form = await request.formData();
    const q = String(form.get('q') || '').trim();
    throw redirect(303, `/search?q=${encodeURIComponent(q)}`);
  }
};
