import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { accountDomain } from '$lib/server/foundation/provisioning';
import { foundationDorianAgent, foundationDorianAvailable } from '$lib/server/foundation/dorianCallConfig';
import { registerDorianCall } from '$lib/server/foundation/dorianCalls';
import { resolveFoundationAccess } from '$lib/server/foundation/policy';
import { issueDorianWebToken } from '$lib/server/integrations/elevenlabs/webToken';

async function requireDorian(locals: App.Locals, url: URL) {
	const agentId = foundationDorianAgent();
	if (!agentId || !foundationDorianAvailable(locals, url) ||
		await accountDomain(locals.user!.id) !== 'ACTIVE')
		throw error(404, 'Dorian is unavailable.');
	return agentId;
}

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	await requireDorian(locals, url);
	setHeaders({ 'cache-control': 'private, no-store' });
	return {};
};

export const actions: Actions = {
	start: async ({ locals, url, request, fetch, setHeaders }) => {
		const agentId = await requireDorian(locals, url);
		setHeaders({ 'cache-control': 'private, no-store' });
		if (request.headers.get('origin') !== url.origin) throw error(403, 'Submit from the Dorian page.');
		if ((await request.formData()).get('consent') !== '1')
			return fail(400, { error: 'Please agree to the conversation terms to continue.' });
		try {
			const access = await resolveFoundationAccess(locals, 'READ');
			const issued = await issueDorianWebToken(agentId, fetch);
			if (!('token' in issued)) return issued;
			if (!issued.conversationId) return fail(502, { error: 'Dorian could not start the conversation.' });
			// Store the provider binding and consent before releasing the token to the browser.
			await registerDorianCall(access, agentId, issued.conversationId);
			return { token: issued.token, reference: issued.reference };
		} catch {
			return fail(503, { error: 'Dorian could not start the conversation. Try again.' });
		}
	}
};
