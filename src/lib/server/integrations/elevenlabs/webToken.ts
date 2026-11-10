import { randomUUID } from 'node:crypto';
import { fail } from '@sveltejs/kit';

// Only emit recognized provider codes. The response body and exception can contain private data.
const providerCodes = new Set([
  'invalid_api_key', 'missing_permissions', 'agent_not_found', 'not_found',
  'unauthorized', 'forbidden', 'quota_exceeded', 'rate_limit_exceeded',
  'too_many_concurrent_requests', 'validation_error'
]);

async function providerCode(response: Response) {
  try {
    const { detail } = await response.json();
    return providerCodes.has(detail?.status) ? detail.status as string : undefined;
  } catch {
    return undefined;
  }
}

export async function issueDorianWebToken(agentId: string, fetch: typeof globalThis.fetch) {
  const reference = randomUUID();
  const started = performance.now();
  const diagnostic = (reason: string, upstreamStatus?: number, code?: string) => ({
    component: 'relish.dorian.web_test', stage: 'token', reference, reason,
    upstreamStatus, providerCode: code, elapsedMs: Math.round(performance.now() - started)
  });
  const failure = (reason: string, status = 502, upstreamStatus?: number, code?: string) => {
    console.warn(JSON.stringify(diagnostic(reason, upstreamStatus, code)));
    return fail(status, {
      error: status === 503 ? 'The test service is not configured.' : 'Dorian could not connect. Try again.',
      reference
    });
  };
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return failure('missing_api_key', 503);

  // Request the short-lived browser token and the provider-side conversation identifier.
  const endpoint = new URL('https://api.elevenlabs.io/v1/convai/conversation/token');
  endpoint.searchParams.set('agent_id', agentId);
  const timeout = AbortSignal.timeout(8000);
  let upstreamStatus: number | undefined;
  try {
    const response = await fetch(endpoint, {
      headers: { 'xi-api-key': apiKey },
      signal: timeout
    });
    upstreamStatus = response.status;
    if (!response.ok)
      return failure('provider_rejected', 502, response.status, await providerCode(response));

    const body = await response.json();
    if (typeof body?.token !== 'string' || !body.token)
      return failure('missing_token', 502, response.status);

    console.info(JSON.stringify(diagnostic('issued', response.status)));
    const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : null;
    return { token: body.token as string, reference, conversationId };
  } catch {
    const reason = timeout.aborted ? 'provider_timeout' :
      upstreamStatus === undefined ? 'provider_request_failed' : 'invalid_provider_response';
    return failure(reason, 502, upstreamStatus);
  }
}
