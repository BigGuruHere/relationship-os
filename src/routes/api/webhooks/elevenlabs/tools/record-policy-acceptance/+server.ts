import { requiredEnv } from '$lib/server/config/requiredEnv';
// Stage 8.19 - Session-scoped terms acceptance. Configure this tool in ElevenLabs.
// All values except the Boolean consent assertion are independently verified server-side.
import { timingSafeEqual } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recordRelishVoicePolicyAcceptance } from '$lib/server/core/relishCallPolicy';

function authenticProvider(header: string | null) {
  const secret = requiredEnv('ELEVENLABS_TOOL_SECRET', 24);
  const expected = Buffer.from('Bearer ' + secret);
  const actual = Buffer.from(header || '');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const POST: RequestHandler = async ({ request }) => {
  if (!authenticProvider(request.headers.get('authorization'))) return json({ status: 'UNAUTHORISED' }, { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return json({ status: 'INVALID_REQUEST' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ status: 'INVALID_REQUEST' }, { status: 400 });
  try {
    const result = await recordRelishVoicePolicyAcceptance({
      token: body.relish_network_session, conversationId: body.conversation_id, agreement: body.agreement
    });
    const status = result.status === 'UNAUTHORISED' ? 403 : result.status === 'NOT_ACCEPTED' ? 409 : 200;
    // Only result/status are logged. Never log raw prompts, names or tokens.
    console.info('[relish-policy-tool]', { status: result.status, httpStatus: status });
    return json(result, { status });
  } catch {
    console.error('[relish-policy-tool] failed');
    return json({ status: 'ERROR' }, { status: 500 });
  }
};
