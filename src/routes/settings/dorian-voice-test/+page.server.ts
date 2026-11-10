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

export const actions: Actions = {
  default: async ({ locals, url, request, fetch, setHeaders }) => {
    const agentId = testAgent(locals, url);
    if (request.headers.get('origin') !== url.origin) {
      return fail(403, { error: 'Start the conversation from the test page.' });
    }
    setHeaders({ 'cache-control': 'private, no-store' });
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return fail(503, { error: 'The test service is not configured.' });

    // The browser receives only the short-lived conversation token.
    const endpoint = new URL('https://api.elevenlabs.io/v1/convai/conversation/token');
    endpoint.searchParams.set('agent_id', agentId);
    try {
      const response = await fetch(endpoint, {
        headers: { 'xi-api-key': apiKey },
        signal: AbortSignal.timeout(8000)
      });
      if (response.ok) {
        const { token } = await response.json();
        if (typeof token === 'string' && token) return { token };
      }
    } catch {
      // Keep provider errors and credentials out of the browser.
    }
    return fail(502, { error: 'Dorian could not connect. Try again.' });
  }
};
