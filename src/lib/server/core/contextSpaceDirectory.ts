// src/lib/server/core/contextSpaceDirectory.ts
// PURPOSE: Create and display owned application ContextSpaces through controlled server actions.
// SECURITY: ContextSpace display names are encrypted because a label may reveal sensitive purpose.

import { encrypt, decrypt } from '$lib/crypto';
import { normalizeContextDomainKey } from '$lib/server/core/contextDomain';

const DISPLAY_NAME_AAD = 'context_space.display_name';

type ContextSpaceDirectoryClient = {
	contextSpace: {
		findFirst(args: any): Promise<any>;
		create(args: any): Promise<any>;
	};
};

export function encryptContextSpaceDisplayName(value: string) {
	const clean = String(value ?? '').trim();
	return clean ? encrypt(clean, DISPLAY_NAME_AAD) : null;
}

export function decryptContextSpaceDisplayName(value: string | null | undefined, fallback: string) {
	if (!value) return fallback;
	try {
		return decrypt(value, DISPLAY_NAME_AAD);
	} catch {
		return fallback;
	}
}

export async function ensureOwnedDomainContextSpace(
	client: ContextSpaceDirectoryClient,
	params: { ownerUserId: string; domainKey: string; displayName: string }
) {
	const ownerUserId = String(params.ownerUserId ?? '').trim();
	const domainKey = normalizeContextDomainKey(params.domainKey);
	if (!ownerUserId) throw new Error('Missing ContextSpace owner.');

	const existing = await client.contextSpace.findFirst({
		where: { ownerUserId, domainKey },
		orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
	});
	if (existing) return existing;

	// IT: Application setup creates one initial space. The schema remains capable of multiple spaces per domain later.
	return client.contextSpace.create({
		data: {
			ownerUserId,
			kind: 'WORKSPACE',
			domainKey,
			displayNameEnc: encryptContextSpaceDisplayName(params.displayName),
			isDefault: false
		}
	});
}
