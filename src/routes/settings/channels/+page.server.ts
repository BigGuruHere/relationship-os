import {
	reportChannelFailure,
	channelFailureMessage
} from '$lib/server/foundation/channelDiagnostics';
import { emailVerificationConfigured } from '$lib/server/integrations/resend/verification';
// Account settings reuse the existing session, DEV admission and strict native POST checks.
import { fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
import {
	listAccountChannels,
	addAccountChannel,
	requestAccountChannelCode,
	dispatchAccountChannelCode,
	verifyAccountChannelCode,
	revokeAccountChannel,
	eraseRevokedAccountChannel
} from '$lib/server/foundation/accountChannels';
export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	if (!locals.user) throw redirect(303, '/auth/login');
	setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'same-origin' });
	try {
		return {
			channels: await listAccountChannels(locals),
			available: true,
			emailEnabled: emailVerificationConfigured()
		};
	} catch (failure) {
		const { reference, reason } = reportChannelFailure('load', failure);
		return { channels: [], available: false, reference, error: channelFailureMessage(reason) };
	}
};
export const actions: Actions = {
	default: async ({ locals, url, request, getClientAddress }) => {
		if (request.headers.get('origin') !== url.origin)
			return fail(403, { error: 'Please submit from this page.' });
		if (!locals.user) throw redirect(303, '/auth/login');
		if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))
			return fail(415, { error: 'Use the settings form.' });
		const raw = await request.text();
		if (raw.length > 2048) return fail(413, { error: 'Submission too large.' });
		const form = new URLSearchParams(raw),
			id = form.get('channelId') || '',
			intent = form.get('intent');
		try {
			if (intent === 'add') {
				await addAccountChannel(locals, form.get('type') || '', form.get('value') || '');
				return {
					message:
						'Added as pending. Click Send verification code beside this channel to receive a code.'
				};
			}
			if (intent === 'send') {
				const issued = await requestAccountChannelCode(
					locals,
					id,
					randomUUID(),
					getClientAddress()
				);
				if (issued.status === 'VERIFIED') return { message: 'This channel is already verified.' };
				if (issued.status === 'LIMITED')
					return fail(429, { error: 'Please wait before requesting another code.' });
				let deliveryReference: string | undefined;
				const delivery = await dispatchAccountChannelCode(locals, issued.challengeId, (ref) => {
					deliveryReference = ref;
				});
				return {
					reference: deliveryReference,
					challengeId: issued.challengeId,
					channelId: id,
					...(delivery === 'SENT'
						? { message: 'Code sent. Enter it below.' }
						: { error: 'Delivery failed. Retry this code or request another after a minute.' })
				};
			}
			if (intent === 'retry') {
				const challengeId = form.get('challengeId') || '';
				let deliveryReference: string | undefined;
				const delivery = await dispatchAccountChannelCode(locals, challengeId, (ref) => {
					deliveryReference = ref;
				});
				return {
					reference: deliveryReference,
					channelId: id,
					challengeId,
					...(delivery === 'SENT'
						? { message: 'Code sent.' }
						: { error: 'Delivery failed. You can continue later.' })
				};
			}
			if (intent === 'verify') {
				const challengeId = form.get('challengeId') || '';
				const result = await verifyAccountChannelCode(
					locals,
					challengeId,
					form.get('code') || '',
					getClientAddress()
				);
				if (result === 'VERIFIED') return { message: 'Channel verified.' };
				return fail(400, {
					channelId: id,
					challengeId,
					error:
						result === 'LIMITED'
							? 'Please wait before trying again.'
							: 'That code did not match. Please try again.'
				});
			}
			if (intent === 'revoke') {
				await revokeAccountChannel(locals, id);
				return { message: 'Verification revoked. New use requires a fresh check.' };
			}
			if (intent === 'erase') {
				await eraseRevokedAccountChannel(locals, id);
				return { message: 'Channel and its verification history removed.' };
			}
			return fail(400, { error: 'Choose an action from this page.' });
		} catch (failure) {
			const { reference, reason } = reportChannelFailure(intent || 'unknown', failure);
			return fail(['SCHEMA_NOT_READY', 'DATABASE_UNAVAILABLE'].includes(reason) ? 503 : 400, {
				reference,
				error: channelFailureMessage(reason)
			});
		}
	}
};
