import { exchangeBrowserEnabled } from '$lib/server/foundation/devPilotGate';
// Same-origin forms are the only browser entry to proof consumption. No capability appears in URLs.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { randomUUID } from 'node:crypto';
import {
	readExchange,
	bindExchangeChallenge,
	clearExchange,
	EXCHANGE_RETURN
} from '$lib/server/exchangeOnboarding';
import {
	requestExchangeCode,
	dispatchExchangeCode,
	verifyExchangeCode
} from '$lib/server/foundation/exchangeClaims';
import { accountDomain } from '$lib/server/foundation/provisioning';

export const load: PageServerLoad = async ({ locals, cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
	const claim = readExchange(cookies);
	return {
		available: Boolean(claim && exchangeBrowserEnabled(locals, url.origin)),
		signedIn: Boolean(locals.user),
		ready: Boolean(locals.user && (await accountDomain(locals.user.id)) === 'ACTIVE'),
		codeRequested: Boolean(
			claim?.challengeId &&
				claim.accountId === locals.user?.id &&
				claim.sessionId === locals.sessionId
		)
	};
};
export const actions: Actions = {
	default: async ({ locals, cookies, request, url, getClientAddress }) => {
		if (request.headers.get('origin') !== url.origin)
			return fail(403, { error: 'Please submit from this page.' });
		if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))
			return fail(415, { error: 'Use the verification form.' });
		const body = await request.text();
		if (body.length > 2048) return fail(413, { error: 'Submission is too large.' });
		const form = new URLSearchParams(body);
		if (form.get('intent') === 'later') {
			// Keep the browser continuation until expiry so Continue later can resume.
			throw redirect(303, locals.user ? '/profiles' : '/');
		}
		if (!exchangeBrowserEnabled(locals, url.origin))
			return fail(404, { error: 'Verification is unavailable.' });
		if (!locals.user || !locals.sessionId)
			throw redirect(303, '/auth/login?next=' + encodeURIComponent(EXCHANGE_RETURN));
		const claim = readExchange(cookies);
		if (!claim)
			return fail(400, {
				error: 'This exchange has expired. Share your details again to continue.'
			});
		try {
			// Bounded per-owner expiry maintenance runs before any new delivery request.
			// This browser adapter calls only the reviewed service, never a privacy authority constructor.
			if (['send', 'resend'].includes(form.get('intent') || '')) {
				const issued = await requestExchangeCode(
					locals,
					claim.token,
					form.get('intent') !== 'resend' &&
						claim.challengeId &&
						claim.sessionId === locals.sessionId
						? claim.challengeId
						: randomUUID(),
					getClientAddress()
				);
				if (issued.status === 'LIMITED')
					return fail(429, { error: 'Please wait before requesting another code.' });
				if (issued.status === 'SETTLED') throw redirect(303, '/people');
				bindExchangeChallenge(
					cookies,
					url,
					claim,
					issued.challengeId,
					locals.user.id,
					locals.sessionId
				);
				const delivery = await dispatchExchangeCode(locals, claim.token, issued.challengeId);
				return delivery.status === 'SENT'
					? { sent: true }
					: fail(503, {
							error: 'The code could not be delivered. You can retry or continue later.'
						});
			}
			if (
				form.get('intent') !== 'verify' ||
				!claim.challengeId ||
				claim.accountId !== locals.user.id ||
				claim.sessionId !== locals.sessionId
			)
				return fail(400, { error: 'Request a code from this session first.' });
			const result = await verifyExchangeCode(
				locals,
				claim.token,
				claim.challengeId,
				form.get('code') || '',
				getClientAddress()
			);
			if (result.status !== 'SETTLED')
				return fail(400, {
					error:
						result.status === 'LIMITED'
							? 'Please wait before trying again.'
							: 'That code did not match. Please try again.'
				});
		} catch (e) {
			if (typeof e === 'object' && e && 'status' in e && (e as { status: number }).status === 303)
				throw e;
			return fail(400, {
				error:
					'This exchange cannot be verified now. Check your account or share your details again. Your saved contact is kept.'
			});
		}
		clearExchange(cookies);
		throw redirect(303, '/people');
	}
};
