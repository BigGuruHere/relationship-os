import { prisma } from '$lib/db';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { callerHasAcceptedCurrentTerms, currentRelishPolicy, recordRelishBrowserPolicyAcceptance } from '$lib/server/core/relishCallPolicy';
import { accountDomain } from '$lib/server/foundation/provisioning';
import { dorianProcessingMessage, foundationDorianAgent, foundationDorianAvailable } from '$lib/server/foundation/dorianCallConfig';
import { dorianCallProcessing, DorianCallProcessing, prepareDorianCall, registerDorianCall } from '$lib/server/foundation/dorianCalls';
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
	const policy = currentRelishPolicy();
	return {
		policyVersion: policy.valid ? policy.version : null,
		accepted: await callerHasAcceptedCurrentTerms(locals.user!.id, policy)
	};
};

export const actions: Actions = {
	start: async ({ locals, url, request, fetch, setHeaders }) => {
		const agentId = await requireDorian(locals, url);
		setHeaders({ 'cache-control': 'private, no-store' });
		if (request.headers.get('origin') !== url.origin) throw error(403, 'Submit from the Dorian page.');
		const policy = currentRelishPolicy();
		if (!policy.valid) return fail(503, { error: 'Dorian is temporarily unavailable.' });
		const userId = locals.user!.id;
		try {
			const accepted = await callerHasAcceptedCurrentTerms(userId, policy);
			if (!accepted) {
				const form = await request.formData();
				// The form must refer to the version shown when the participant agreed.
				if (form.get('consent') !== '1' || form.get('policyVersion') !== policy.version)
					return fail(400, { error: 'Please refresh the page and agree to the current terms to continue.' });
				if (!locals.sessionId) return fail(403, { error: 'Sign in again to accept the terms.' });
			}
			const access = await resolveFoundationAccess(locals, 'READ');
			if (await dorianCallProcessing(prisma, userId, access.vaultId, access.epoch))
				return fail(409, { error: dorianProcessingMessage });
			const issued = await issueDorianWebToken(agentId, fetch);
			if (!('token' in issued)) return issued;
			if (!issued.conversationId) return fail(502, { error: 'Dorian could not start the conversation.' });
			if (!accepted) await recordRelishBrowserPolicyAcceptance(policy, {
				userId, authSessionId: locals.sessionId!, conversationId: issued.conversationId
			});
			// Store the provider binding and consent before releasing the token to the browser.
			const call = await registerDorianCall(access, agentId, issued.conversationId);
			const initiation = await prepareDorianCall(call.id);
			return { token: issued.token, reference: issued.reference, initiation };
		} catch (cause) {
			if (cause instanceof DorianCallProcessing) return fail(409, { error: dorianProcessingMessage });
			return fail(503, { error: 'Dorian could not start the conversation. Try again.' });
		}
	}
};
