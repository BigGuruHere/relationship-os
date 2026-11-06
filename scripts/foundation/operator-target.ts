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
