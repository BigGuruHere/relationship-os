// Stage 8.15.4.7e: ElevenLabs server tool. Configure a dedicated Bearer secret.
// SECURITY: Secret authenticates provider; opaque session token + conversation id authorise target.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { saveProvisionalPreferredName } from '$lib/server/integrations/elevenlabs/preferredName';

function providerAuthorised(value: string | null) {
  const secret = process.env.RELISH_ELEVENLABS_TOOL_SECRET || '';
  if (secret.length < 24) return false;
  const supplied = Buffer.from(value || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

// Log all name-tool requests that reach Relish without revealing credentials,
// session tokens, conversation identifiers, participant names or private evidence.
export const POST: RequestHandler = async ({ request }) => {
  const requestId = randomUUID().slice(0, 8);
  const log = (event: string, details: Record<string, unknown> = {}) =>
    console.info(`[ElevenLabs][name-tool_${requestId}][${event}]`, details);
  log('REQUEST', { method: request.method, path: '/api/webhooks/elevenlabs/tools/save-preferred-name' });

  if (!providerAuthorised(request.headers.get('authorization'))) {
    log('RESPONSE', { httpStatus: 401, reason: 'PROVIDER_AUTH_FAILED' });
    return json({ status: 'UNAUTHORISED' }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    log('RESPONSE', { httpStatus: 400, reason: 'INVALID_JSON' });
    return json({ status: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    log('RESPONSE', { httpStatus: 400, reason: 'INVALID_BODY' });
    return json({ status: 'INVALID_REQUEST' }, { status: 400 });
  }
  log('VALIDATE', {
    hasPreferredName: typeof body.preferred_name === 'string',
    hasSessionToken: typeof body.relish_network_session === 'string',
    hasConversationId: typeof body.conversation_id === 'string'
  });
  try {
    const result = await saveProvisionalPreferredName({
      sessionToken: body.relish_network_session,
      conversationId: body.conversation_id,
      preferredName: body.preferred_name
    });
    const httpStatus = result.status === 'UNAUTHORISED' ? 403 : result.status === 'INVALID_NAME' ? 400 : 200;
    log('RESPONSE', { httpStatus, result: result.status });
    // Never echo a participant name in logs. Keep the existing tool response contract.
    return json(result, { status: httpStatus });
  } catch (error) {
    // Avoid logging Prisma error details, which may contain sensitive SQL parameters.
    log('ERROR', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    return json({ status: 'INTERNAL_ERROR' }, { status: 500 });
  }
};
