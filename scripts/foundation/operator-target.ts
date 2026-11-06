// Guard offline commands before Prisma reads any database configuration.
export function checkOperatorTarget(expected: string | undefined) {
	// Verify the chosen endpoint and database before loading Prisma. Reject query parameters
	// that might redirect the connection or select another schema.
	const url = new URL(process.env.DATABASE_URL ?? '');
	const options = new Set([
		'sslmode',
		'channel_binding',
		'connect_timeout',
		'connection_limit',
		'pool_timeout',
		'schema'
	]);
	if (
		!['postgresql:', 'postgres:'].includes(url.protocol) ||
		!url.hostname ||
		!/^\/[a-z0-9_-]+$/i.test(url.pathname) ||
		url.hash ||
		[...url.searchParams.keys()].some(
			(key) => !options.has(key) || url.searchParams.getAll(key).length !== 1
		) ||
		(url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') ||
		expected !== url.host + url.pathname
	)
		throw new Error('Explicit database target required.');
	return url;
}

// Require an explicitly selected restored copy of the same database.
export function checkRehearsalTarget() {
	const clone = checkOperatorTarget(process.env.P305_EXPECTED_TARGET);
	const sourceTarget = process.env.P306_SOURCE_TARGET ?? '';
	if (!/^[a-z0-9.-]+(?::[0-9]+)?\/[a-z0-9_-]+$/i.test(sourceTarget))
		throw new Error('Explicit source DEV endpoint required.');
	const source = new URL('postgresql://' + sourceTarget);
	// Treat pooled and direct Neon hosts as the same branch, even with a different database or port.
	const endpoint = (host: string) =>
		host
			.toLowerCase()
			.replace(/-pooler(?=\.)/, '')
			.replace(/\.$/, '');
	if (source.pathname !== clone.pathname || endpoint(source.hostname) === endpoint(clone.hostname))
		throw new Error('The source and rehearsal endpoints must be separate.');
}
