// src/routes/search/+page.server.ts
// PURPOSE: Semantic search results for interactions (notes) with decrypted contact names.
// NOTES:
// - Requires login and scopes everything by locals.user.id.
// - Keeps the ranking from semanticSearchInteractions (highest score first).
// - Secondary tie breaker by occurredAt DESC.
// SECURITY: Decrypt on the server only.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { semanticSearchInteractions } from '$lib/embeddings';
import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  // Require login
  if (!locals.user) throw redirect(303, '/auth/login');

  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return { q: '', results: [], error: null };

  try {
    // Rank interactions by semantics within this tenant
    const hits = await semanticSearchInteractions(q, locals.user.id, 12);
    if (hits.length === 0) return { q, results: [], error: null };

    // Fetch minimal info about the related contacts scoped by user
    const ids = hits.map((h) => h.contactId);
    const contacts = await prisma.contact.findMany({
      where: { userId: locals.user.id, id: { in: ids } },
      select: { id: true, fullNameEnc: true }
    });

    const nameMap = new Map(
      contacts.map((c) => {
        try {
          return [c.id, decrypt(c.fullNameEnc, 'contact.full_name') as string];
        } catch {
          return [c.id, '(name unavailable)'];
        }
      })
    );

    // Merge names into search results
    const results = hits.map((h) => ({
      id: h.id,
      contactId: h.contactId,
      contactName: nameMap.get(h.contactId) || '(unknown)',
      occurredAt: h.occurredAt,
      channel: h.channel,
      score: h.score
    }));

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
    if (!q) return fail(400, { error: 'Please enter a search query' });
    throw redirect(303, `/search?q=${encodeURIComponent(q)}`);
  }
};
