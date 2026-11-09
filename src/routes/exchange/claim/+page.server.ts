import { ChannelDenied, channelFailureMessage } from '$lib/server/foundation/channelDiagnostics';
import { requestAccountChannelCode,dispatchAccountChannelCode,verifyAccountChannelCode } from '$lib/server/foundation/accountChannels';
import { profileExchangeReturn, clearProfileExchangeReturn } from '$lib/server/profileExchangeReturn';
import { reportExchangeFailure, ExchangeDenied } from '$lib/server/foundation/exchangeDiagnostics';
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
	accountClaimState, prepareAccountClaim, completeAccountClaim,
	requestExchangeCode,
	dispatchExchangeCode,
	verifyExchangeCode
} from '$lib/server/foundation/exchangeClaims';
import { accountDomain } from '$lib/server/foundation/provisioning';

export const load: PageServerLoad = async ({ locals, cookies, setHeaders, url }) => {
	setHeaders({
		'cache-control': 'private, no-store', // Native POST forms need a non-null Origin for strict CSRF checks.
		'referrer-policy': 'same-origin'
	});
	// Sign-in return is navigation only; profile ownership is checked later at confirmation.
	const profileReturn = locals.user && exchangeBrowserEnabled(locals,url.origin) ? profileExchangeReturn(cookies,'visitor') : null;
	if(profileReturn){ clearProfileExchangeReturn(cookies); throw redirect(303,profileReturn); }
	const claim = readExchange(cookies);
	const enabled = exchangeBrowserEnabled(locals, url.origin);
	// Old links can still arrive here, but signed-out guests use the existing registration screen.
	if (claim && enabled && !locals.user)
		throw redirect(303, '/auth/register?next=' + encodeURIComponent(EXCHANGE_RETURN));
    let accountClaim=null;
    if(claim?.version===2 && locals.user && enabled) {
      try{accountClaim=await accountClaimState(locals,claim.token);}catch{/* Keep pending account proof usable even if the source was withdrawn. */}
    }
	return {version:claim?.version || 1,accountClaim,
		available: Boolean(claim && enabled),
		ready: Boolean(locals.user && (await accountDomain(locals.user.id)) === 'ACTIVE'),
		codeRequested: Boolean(
			claim?.challengeId &&
				(claim.version !== 2 || !accountClaim || claim.channelType === accountClaim.channel.step) &&
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
		if (claim.version === 2) {
			const intent = form.get('intent');
			let operation: 'request' | 'dispatch' | 'verify' | 'settle' =
				intent === 'complete' ? 'settle' : intent === 'verify' ? 'verify' : 'request';
			try {
				if (intent === 'complete') {
					await completeAccountClaim(locals, claim.token);
					return { completed: true };
				}
				if (intent === 'send' || intent === 'resend') {
					const step = form.get('channelType') || '';
					const channelId = await prepareAccountClaim(locals, claim.token, step);
					const requestId = intent === 'send' && claim.channelType === step &&
						claim.sessionId === locals.sessionId && claim.challengeId ? claim.challengeId : randomUUID();
					const issued = await requestAccountChannelCode(locals, channelId, requestId, getClientAddress());
					if (issued.status === 'VERIFIED') return { verified: true };
					if (issued.status === 'LIMITED')
						return fail(429, { error: 'Please wait before requesting another code.' });
					bindExchangeChallenge(cookies, url, claim, issued.challengeId, locals.user.id, locals.sessionId, step);
					operation = 'dispatch';
					const delivery = await dispatchAccountChannelCode(locals, issued.challengeId);
					return delivery === 'SENT'
						? { sent: true }
						: fail(503, { error: 'Delivery failed. Please request a new code.' });
				}
				if (intent !== 'verify' || !claim.challengeId || claim.accountId !== locals.user.id ||
					claim.sessionId !== locals.sessionId)
					return fail(400, { error: 'Request a code from this session first.' });
				const result = await verifyAccountChannelCode(locals, claim.challengeId, form.get('code') || '', getClientAddress());
				if (result !== 'VERIFIED')
					return fail(400, { error: result === 'LIMITED'
						? 'Please wait before trying again.'
						: 'That code did not match. Please try again.' });

				// Proof commits first. A different sign-in email advances to shared-channel
				// verification, while withdrawal or archiving can still block settlement.
				try {
					const state = await accountClaimState(locals, claim.token);
					if (!state.canComplete) return { verified: true };
					await completeAccountClaim(locals, claim.token);
					return { completed: true };
				} catch (e) {
					return fail(409, {
						verified: true,
						reference: reportExchangeFailure('settle', e),
						error: 'Your account details are verified. We couldn’t finish this step. Please try again.'
					});
				}
			} catch (e) {
				const reference = reportExchangeFailure(operation, e);
				if (e instanceof ChannelDenied && e.reason === 'CHANNEL_ALREADY_VERIFIED')
					return fail(409, { reference, error: channelFailureMessage(e.reason) });
				return fail(400, { reference, error: 'We couldn’t complete this step. Please try again.' });
			}
		}
		let operation: 'request' | 'dispatch' | 'verify' = 'request';
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
				operation = 'dispatch';
				const delivery = await dispatchExchangeCode(locals, claim.token, issued.challengeId);
				const reference =
					delivery.status === 'SENT'
						? undefined
						: reportExchangeFailure('dispatch', new ExchangeDenied('DELIVERY_FAILED'));
				return delivery.status === 'SENT'
					? { sent: true }
					: fail(503, {
							reference,
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
			operation = 'verify';
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
			const reference = reportExchangeFailure(operation, e);
			return fail(400, {
				reference,
				error:
					'This exchange cannot be verified now. Check your account or share your details again. Your saved contact is kept.'
			});
		}
		clearExchange(cookies);
		throw redirect(303, '/people');
	}
};
