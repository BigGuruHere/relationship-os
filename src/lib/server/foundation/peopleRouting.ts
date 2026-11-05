// Server-owned rollout boundary for the existing People pages. Request fields never select storage.
import { error } from '@sveltejs/kit';
import { accountDomain } from './provisioning';
import { FoundationDenied } from './internal';

export async function peopleRouteDomain(userId: string, pathname: string) {
	const domain = await accountDomain(userId);
	if (domain === 'SUSPENDED') throw error(503, 'People storage is temporarily unavailable.');
	if (domain !== 'ACTIVE') return 'LEGACY' as const;
	// P-301 enables only directory/create/detail. Notes, uploads and transcription await P-303.
	if (!/^\/people(?:\/(?:new|[0-9a-f-]{36}))?\/?$/i.test(pathname))
		throw error(503, 'This People feature is not available yet.');
	return 'FOUNDATION' as const;
}

// Missing, archived, foreign and stale resources have the same public response.
export async function foundationPage<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (e) {
		if (e instanceof FoundationDenied) throw error(404, 'Person unavailable.');
		throw e;
	}
}
