// src/lib/server/core/contextDomain.ts
// PURPOSE: Resolve the application domain and owned ContextSpace for each authenticated request.
// SECURITY: Client-selected ContextSpace ids are hints only. Ownership and domain are always rechecked server-side.

export const BUSINESS_DOMAIN_KEY = 'business';
export const DATING_DOMAIN_KEY = 'dating';

export type ContextDomainKey = string;

type ContextSpaceLookupClient = {
	contextSpace: {
		findFirst(args: any): Promise<{
			id: string;
			ownerUserId: string;
			domainKey: string;
			displayNameEnc: string | null;
			isDefault: boolean;
		} | null>;
	};
};

export function normalizeContextDomainKey(value: unknown) {
	const key = String(value ?? '')
		.trim()
		.toLowerCase();
	if (!/^[a-z][a-z0-9_-]{0,63}$/.test(key)) {
		throw new Error('Invalid ContextSpace domain key.');
	}
	return key;
}

export function contextDomainForPathname(pathname: string): ContextDomainKey {
	const path = String(pathname || '/');
	// IT: Domain selection comes from a server-owned route boundary, not from an arbitrary query parameter.
	if (path === '/dating' || path.startsWith('/dating/')) return DATING_DOMAIN_KEY;
	return BUSINESS_DOMAIN_KEY;
}

export function contextSelectionCookieName(domainKey: string) {
	return `relish_ctx_${normalizeContextDomainKey(domainKey)}`;
}

export async function resolveContextSpaceForDomain(
	client: ContextSpaceLookupClient,
	params: { ownerUserId: string; domainKey: string; preferredContextSpaceId?: string | null }
) {
	const ownerUserId = String(params.ownerUserId ?? '').trim();
	const domainKey = normalizeContextDomainKey(params.domainKey);
	const preferredContextSpaceId = String(params.preferredContextSpaceId ?? '').trim();
	if (!ownerUserId) throw new Error('Missing ContextSpace owner for request resolution.');

	if (preferredContextSpaceId) {
		const preferred = await client.contextSpace.findFirst({
			where: { id: preferredContextSpaceId, ownerUserId, domainKey },
			select: {
				id: true,
				ownerUserId: true,
				domainKey: true,
				displayNameEnc: true,
				isDefault: true
			}
		});
		if (preferred) return preferred;
	}

	// IT: A deterministic default is preferred inside a domain, then the oldest created space.
	return client.contextSpace.findFirst({
		where: { ownerUserId, domainKey },
		select: { id: true, ownerUserId: true, domainKey: true, displayNameEnc: true, isDefault: true },
		orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
	});
}
