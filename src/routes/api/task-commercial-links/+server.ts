// src/routes/api/task-commercial-links/+server.ts
// PURPOSE: Server-side search endpoint for scalable Task -> Want/Offer linking.
// SECURITY: Requires an authenticated Relish user and always tenant-scopes suggestion queries.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTaskCommercialLinkSuggestions, type TaskCommercialLinkKind } from '$lib/server/taskLinkSuggestions';

function value(url: URL, key: string) {
  return String(url.searchParams.get(key) || '').trim() || null;
}

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const rawKind = String(url.searchParams.get('kind') || '').trim().toLowerCase();
  if (rawKind !== 'want' && rawKind !== 'offer') return json({ error: 'kind must be want or offer' }, { status: 400 });
  const kind = rawKind as TaskCommercialLinkKind;

  const suggestions = await getTaskCommercialLinkSuggestions({
    userId: locals.user.id,
    kind,
    query: String(url.searchParams.get('q') || ''),
    context: {
      contactId: value(url, 'contactId'),
      companyId: value(url, 'companyId'),
      dealId: value(url, 'dealId'),
      projectId: value(url, 'projectId'),
      workstreamId: value(url, 'workstreamId'),
      selectedId: value(url, 'selectedId')
    },
    limit: 15
  });

  return json({ suggestions });
};
