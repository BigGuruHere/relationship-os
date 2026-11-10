import { randomUUID } from 'node:crypto';
import { error, fail } from '@sveltejs/kit';
import { resolveOrigin } from '$lib/env';
import type { Actions, PageServerLoad } from './$types';

// Use a dedicated test agent, independent of the existing phone and widget deployments.
function testAgent(locals: App.Locals, url: URL) {
  const agentId = process.env.RELISH_DORIAN_WEB_TEST_AGENT_ID?.trim();
  if (locals.env !== 'dev' || url.origin !== resolveOrigin('dev') ||
      locals.user?.role !== 'owner' || !agentId) {
    throw error(404, 'Page unavailable.');
  }
  return agentId;
}

export const load: PageServerLoad = ({ locals, url, setHeaders }) => {
  testAgent(locals, url);
  setHeaders({ 'cache-control': 'private, no-store' });
  return {};
};

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

export const actions: Actions = {
  default: async ({ locals, url, request, fetch, setHeaders }) => {
    const agentId = testAgent(locals, url);
    if (request.headers.get('origin') !== url.origin) {
      return fail(403, { error: 'Start the conversation from the test page.' });
    }
    setHeaders({ 'cache-control': 'private, no-store' });
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

    // The browser receives only the short-lived conversation token.
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
      return { token: body.token as string, reference };
    } catch {
      const reason = timeout.aborted ? 'provider_timeout' :
        upstreamStatus === undefined ? 'provider_request_failed' : 'invalid_provider_response';
      return failure(reason, 502, upstreamStatus);
    }
  }
};
