// The creation control requires both the canonical DEV origin and an explicitly bound DEV database.
import { resolveOrigin } from '$lib/env';

export const DEV_PILOT_ID_PREFIX = 'p306-dev-pilot-';

export function devPilotEnabled(locals: Pick<App.Locals, 'env'>, requestOrigin: string) {
	const expected = process.env.RELISH_DEV_FOUNDATION_PILOT_TARGET;
	if (!expected || locals.env !== 'dev' || requestOrigin !== resolveOrigin('dev')) return false;
	try {
		const database = new URL(process.env.DATABASE_URL ?? '');
		const target = new URL('postgresql://' + expected);
		const canonicalHost = (url: URL) => url.host.toLowerCase().replace(/-pooler(?=\.)/, '');
		// Accept the usual Prisma/Neon options, but reject alternate host/schema options.
		const options = new Set([
			'sslmode',
			'channel_binding',
			'connection_limit',
			'connect_timeout',
			'pool_timeout',
			'pgbouncer',
			'statement_cache_size',
			'schema'
		]);
		return (
			['postgres:', 'postgresql:'].includes(database.protocol) &&
			!database.hash &&
			database.hostname !== '' &&
			!target.username &&
			!target.password &&
			!target.search &&
			!target.hash &&
			/^\/[a-z0-9_-]+$/i.test(database.pathname) &&
			[...database.searchParams.keys()].every(
				(key) => options.has(key) && database.searchParams.getAll(key).length === 1
			) &&
			(!database.searchParams.has('schema') || database.searchParams.get('schema') === 'public') &&
			canonicalHost(database) === canonicalHost(target) &&
			database.pathname === target.pathname
		);
	} catch {
		return false;
	}
}

// Browser activation is an explicit DEV-only operator choice, separate from creating a test login.
export function exchangeBrowserEnabled(locals: Pick<App.Locals, 'env'>, origin: string) {
	return (
		process.env.RELISH_EXCHANGE_BROWSER_ENABLED === 'YES' &&
		/^[a-z0-9-]{3,50}$/.test(process.env.RELISH_EXCHANGE_REALM ?? '') &&
		devPilotEnabled(locals, origin)
	);
}
