// src/routes/search/+page.server.ts
// PURPOSE: Minimal semantic search loader for the search page.
// MULTI TENANT: Requires login - every query is scoped by userId.
// UX: Reads q from the URL. If the form ever posts, we redirect to a canonical GET URL.
// NOTE: No diagnostics or plaintext fallback - just embeddings search.

import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { semanticSearchInteractions } from '$lib/embeddings';

export const load: PageServerLoad = async ({ locals, url }) => {
  // Require login for tenant scoping.
  if (!locals.user) throw redirect(303, '/auth/login');

  // Read query string - empty string means no search yet.
  const q = (url.searchParams.get('q') || '').trim();

  // Run semantic search when a query is present.
  const results = q
    ? await semanticSearchInteractions(locals.user.id, q, {
        // comment: permissive threshold keeps rows even when score is tiny
        // comment: change to something like 0.1 if you want to hide weak matches
        minScore: -1,
        limit: 50
      })
    : [];

  return { q, results };
};

// Optional safety - if the form posts by mistake, redirect to GET so load() sees q.
export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const q = String(data.get('q') || '').trim();
    throw redirect(303, q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  }
};
