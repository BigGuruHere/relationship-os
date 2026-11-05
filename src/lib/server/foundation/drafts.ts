// Explicit transient draft processing. This grants no stored-source analysis or disclosure authority.
import { resolveFoundationAccess, withFoundationAccess } from './policy';
export async function resolveDraftProcessing(locals: Pick<App.Locals, 'user'>) {
	const access = await resolveFoundationAccess(locals, 'PROCESS_DRAFT');
	return {
		// Persist the authoritative domain/vault/epoch on the in-memory job. Never use a context cookie.
		key: `foundation:v1:${access.vaultId}:${access.epoch}`,
		authorize: () => withFoundationAccess(access, 'PROCESS_DRAFT', async () => {})
	};
}
