// Fixed reason codes and random references only. Never emit values, account IDs or raw errors.
import { randomUUID } from 'node:crypto';
import { FoundationDenied } from './internal';
const reasons = [
	'INVALID_PHONE',
	'INVALID_EMAIL',
	'INVALID_CHANNEL_TYPE',
	'CHANNEL_LIMIT',
	'CHANNEL_UNAVAILABLE',
	'ENVIRONMENT_DISABLED',
	'SESSION_INVALID',
	'ACCOUNT_INACTIVE',
	'ACCESS_DENIED',
	'EMAIL_NOT_CONFIGURED',
	'DESTINATION_NOT_APPROVED',
	'CHALLENGE_UNAVAILABLE',
	'DELIVERY_EXHAUSTED',
	'EMAIL_API_UNAUTHORIZED',
	'EMAIL_API_FORBIDDEN',
	'EMAIL_API_INVALID_REQUEST',
	'EMAIL_API_RATE_LIMITED',
	'EMAIL_API_UNAVAILABLE',
	'DELIVERY_FAILED',
	'SCHEMA_NOT_READY',
	'DATABASE_UNAVAILABLE',
	'CHANNEL_CONFLICT',
	'CHANNEL_ALREADY_VERIFIED',
	'UNEXPECTED_FAILURE'
] as const;
type Reason = (typeof reasons)[number];
export class ChannelDenied extends FoundationDenied {
	constructor(public readonly reason: Reason) {
		super();
	}
}
export function channelFailureReason(failure: unknown): Reason {
	if (failure instanceof ChannelDenied && reasons.includes(failure.reason)) return failure.reason;
	const code = (failure as { code?: unknown })?.code;
	if (['P2021', 'P2022'].includes(String(code))) return 'SCHEMA_NOT_READY';
	if (['P1001', 'P1002', 'P1017', 'P2024', 'P2028'].includes(String(code)))
		return 'DATABASE_UNAVAILABLE';
	if (code === 'P2002') return 'CHANNEL_CONFLICT';
	if (failure instanceof FoundationDenied) return 'ACCESS_DENIED';
	return 'UNEXPECTED_FAILURE';
}
export function reportChannelFailure(operation: string, failure: unknown) {
	const reference = randomUUID(),
		reason = channelFailureReason(failure);
	console.error(
		JSON.stringify({
			component: 'relish.account.channels',
			reference,
			operation: ['load', 'add', 'send', 'retry', 'verify', 'revoke', 'erase', 'dispatch'].includes(
				operation
			)
				? operation
				: 'unknown',
			reason
		})
	);
	return { reference, reason };
}
export function channelFailureMessage(reason: Reason) {
	switch (reason) {
		case 'INVALID_PHONE':
			return 'Enter an Australian mobile starting with 04 or +614. For an email address, choose Email in the Channel dropdown.';
		case 'INVALID_EMAIL':
			return 'Enter one email address, without a display name or a comma-separated list.';
		case 'INVALID_CHANNEL_TYPE':
			return 'Choose Email or Australian mobile in the Channel dropdown.';
		case 'CHANNEL_LIMIT':
			return 'Remove an unused channel before adding another.';
		case 'EMAIL_NOT_CONFIGURED':
			return 'Email verification is awaiting sender configuration.';
		case 'DESTINATION_NOT_APPROVED':
			return 'This destination is not approved for DEV verification. Check the DEV test recipient allowlist.';
		case 'SCHEMA_NOT_READY':
			return 'Verification storage is not ready. Check that the latest DEV migration completed.';
		case 'DATABASE_UNAVAILABLE':
			return 'Verification storage is temporarily unavailable. Please try again shortly.';
		case 'ENVIRONMENT_DISABLED':
			return 'Verification is not enabled for this DEV configuration.';
		case 'ACCOUNT_INACTIVE':
			return 'Verification requires an active admitted DEV test account.';
		case 'CHANNEL_ALREADY_VERIFIED':
			return 'These details are already verified on another Relish account. If that account is yours, sign in there and choose Revoke verification in Phone and email settings, then try again here.';
		case 'SESSION_INVALID':
			return 'Please sign in again before verifying your details.';
		default:
			return 'This action could not be completed. Check your account or code, or try again later.';
	}
}
