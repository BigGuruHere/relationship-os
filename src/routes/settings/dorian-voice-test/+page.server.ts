import { issueDorianWebToken } from '$lib/server/integrations/elevenlabs/webToken';
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
    const issued = await issueDorianWebToken(agentId, fetch);
    if (!('token' in issued)) return issued;
    return { token: issued.token, reference: issued.reference };
  }
};
