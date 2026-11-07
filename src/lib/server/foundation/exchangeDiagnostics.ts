// Fixed operational classifications only. Never attach private identifiers or raw errors.
import { randomUUID } from 'node:crypto';
import { FoundationDenied } from './internal';
import { captureFailureMetadata } from '$lib/server/core/contactCaptureDiagnostics';
const reasons = [
	'SESSION_INVALID',
	'CONTINUATION_INVALID',
	'EXCHANGE_NOT_FOUND',
	'SELF_EXCHANGE',
	'SOURCE_ROOT_INACTIVE',
	'CLAIMANT_ROOT_INACTIVE',
	'EXCHANGE_ACCOUNT_MISMATCH',
	'PROFILE_UNPUBLISHED',
	'CONTACT_INACTIVE',
	'EXCHANGE_INACTIVE',
	'EXCHANGE_EXPIRED',
	'CHALLENGE_INVALID',
	'CHALLENGE_EXPIRED',
	'ATTEMPT_LIMIT',
	'DESTINATION_UNAVAILABLE',
	'DEV_TARGET_DISABLED',
	'TEST_PHONE_CONFIG_INVALID',
	'DESTINATION_NOT_ALLOWED',
	'DELIVERY_FAILED'
] as const;
export type ExchangeReason = (typeof reasons)[number];
export class ExchangeDenied extends FoundationDenied {
	constructor(readonly reason: ExchangeReason) {
		super();
	}
}
export function reportExchangeFailure(
	operation: 'request' | 'dispatch' | 'verify',
	failure: unknown
) {
	const reference = randomUUID();
	// Validate again at the logging boundary. Provider/SQL messages and arbitrary properties are excluded.
	const reason =
		failure instanceof ExchangeDenied && reasons.includes(failure.reason)
			? failure.reason
			: failure instanceof FoundationDenied
				? 'ACCESS_DENIED'
				: 'UNEXPECTED_FAILURE';
	console.error(
		JSON.stringify({
			component: 'relish.foundation.exchange',
			reference,
			operation,
			reason,
			...captureFailureMetadata(failure)
		})
	);
	return reference;
}
