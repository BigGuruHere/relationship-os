// Purpose and realm separation prevent a copied DEV challenge from being used in PROD.
import { timingSafeEqual } from 'node:crypto';
import { buildScopedMacToken, encrypt, decrypt } from '$lib/crypto';
import { FoundationDenied } from './internal';

export function claimMac(value: string, purpose: string) {
	const realm = process.env.RELISH_EXCHANGE_REALM;
	if (!realm || !/^[a-z0-9-]{3,50}$/.test(realm)) throw new FoundationDenied();
	return buildScopedMacToken(value, 'foundation:exchange:' + realm + ':' + purpose);
}
export function sameMac(actual: string, expected: string) {
	return (
		/^[0-9a-f]{64}$/.test(actual) &&
		timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
	);
}
export function exchangeAad(
	table: string,
	field: string,
	root: { ownerUserId: string; vaultId: string },
	id: string
) {
	return ['foundation', 'v1', table, field, root.ownerUserId, root.vaultId, id].join(':');
}
export function seal(
	table: string,
	field: string,
	root: { ownerUserId: string; vaultId: string },
	id: string,
	value: unknown
) {
	return encrypt(JSON.stringify(value), exchangeAad(table, field, root, id));
}
export function open(
	table: string,
	field: string,
	root: { ownerUserId: string; vaultId: string },
	id: string,
	value: string
) {
	return JSON.parse(decrypt(value, exchangeAad(table, field, root, id)));
}
// First pilot accepts explicit international mobile notation and unambiguous Australian mobile input.
// The verification UI must display this canonical destination before asking to send.
export function verificationPhone(value: string) {
	if (typeof value !== 'string' || value.length > 40 || !/^[+0-9 ()-]+$/.test(value))
		throw new FoundationDenied();
	const compact = value.replace(/[ ()-]/g, '');
	const phone = /^04[0-9]{8}$/.test(compact) ? '+61' + compact.slice(1) : compact;
	if (!/^\+614[0-9]{8}$/.test(phone)) throw new FoundationDenied();
	return phone;
}
