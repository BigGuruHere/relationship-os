import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { accountDomain } from '$lib/server/foundation/provisioning';
import { findIncomingShare } from '$lib/server/foundation/exchangeClaims';

const headers = { 'cache-control': 'private, no-store' };
const empty = () => new Response(null, { status: 204, headers });

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user || !locals.sessionId) return new Response(null, { status: 401, headers });
  const slug = url.searchParams.get('profile') || '';
  const since = Number(url.searchParams.get('since'));
  const now = Date.now();
  if (!slug || slug.length > 256 || !Number.isSafeInteger(since) ||
      since > now || since < now - 15 * 60_000) return empty();
  if (await accountDomain(locals.user.id) !== 'ACTIVE') return empty();
  const personId = await findIncomingShare(locals, slug, new Date(since));
  return personId ? json({ personId }, { headers }) : empty();
};
