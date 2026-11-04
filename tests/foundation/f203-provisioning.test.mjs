// Exercise real provisioning, session issuance and claim dispatch against disposable PostgreSQL.
// This suite never reads DATABASE_URL or modifies a target database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'vite';

process.env.SECRET_MASTER_KEY = 'a'.repeat(64);
process.env.SESSION_COOKIE_SECRET = 'synthetic-session-secret-for-f203';
process.env.SESSION_DAYS = '7';
// An explicit loopback-only, empty fixture database enables real multi-session CI.
const endpoint = process.env.F203_TEST_DATABASE_URL;
let db;
if (endpoint) {
	const url = new URL(endpoint);
	assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
	assert.match(url.pathname, /^\/relish_f203_[a-z0-9_]+$/);
	const { Client } = await import('pg');
	const observer = new Client({ connectionString: endpoint });
	await observer.connect();
	const existing = await observer.query(
		"SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'"
	);
	assert.equal(existing.rows[0].n, 0, 'Use a fresh disposable database');
	db = { exec: (sql) => observer.query(sql), close: () => observer.end(), observer };
} else db = new PGlite();
let socket, client, vite;
try {
	await db.exec(
		'CREATE TABLE "User" (id text PRIMARY KEY); CREATE TABLE "Session" (id text PRIMARY KEY, "userId" text REFERENCES "User"(id), "tokenHash" text UNIQUE, "createdAt" timestamp DEFAULT now(), "expiresAt" timestamp);'
	);
	await db.exec(
		await readFile('prisma/migrations/20261104010000_f202_foundation_schema/migration.sql', 'utf8')
	);
	await db.exec(
		`INSERT INTO "User" VALUES ('legacy'),('prepared'),('active'),('suspended'),('broken'),('archived'),('rollback')`
	);
	if (!endpoint) {
		socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 1 });
		await socket.start();
	}
	client = new PrismaClient({
		datasourceUrl: endpoint
			? endpoint + '?connection_limit=5'
			: 'postgresql://postgres:postgres@' + socket.getServerConn() + '/postgres?connection_limit=1'
	});
	globalThis.__f203client = client;
	vite = await createServer({
		configFile: false,
		server: { middlewareMode: true },
		resolve: { alias: { $lib: resolve('src/lib') } },
		plugins: [
			{
				name: 'f203-isolated-db',
				enforce: 'pre',
				resolveId(id) {
					if (id === '$lib/db' || id === resolve('src/lib/db')) return '\0f203-db';
					if (id === '$app/environment') return '\0f203-environment';
				},
				load(id) {
					if (id === '\0f203-db') return 'export const prisma = globalThis.__f203client;';
					if (id === '\0f203-environment') return 'export const dev = true;';
				}
			}
		]
	});
	const service = await vite.ssrLoadModule('/src/lib/server/foundation/provisioning.ts');
	const auth = await vite.ssrLoadModule('/src/lib/auth.ts');
	const crypto = await vite.ssrLoadModule('/src/lib/crypto.ts');
	const linker = await vite.ssrLoadModule('/src/lib/leads/link.ts');

	await test('legacy session creates no enrollment, vault or self subject', async () => {
		await auth.createSession('legacy');
		assert.equal(await client.foundationEnrollment.count(), 0);
		assert.equal(await client.foundationVault.count(), 0);
		assert.equal(await client.foundationSubject.count(), 0);
		assert.equal(await client.session.count(), 1);
		assert.equal(await service.accountDomain('legacy'), 'LEGACY');
	});
	await test('explicit preparation is atomic and repeatable; self ciphertext is custody bound', async () => {
		const first = await service.prepareFoundationAccount('prepared');
		assert.deepEqual(await service.prepareFoundationAccount('prepared'), first);
		await auth.createSession('prepared');
		assert.equal(await client.foundationVault.count(), 1);
		assert.equal(await client.foundationSubject.count(), 1);
		const self = await client.foundationSubject.findUnique({ where: { selfUserId: 'prepared' } });
		const aad = `foundation:v1:FoundationSubject:displayNameEnc:prepared:${first.vaultId}:${first.selfSubjectId}`;
		assert.equal(crypto.decrypt(self.displayNameEnc, aad), 'Me');
		assert.throws(() => crypto.decrypt(self.displayNameEnc, aad.replace('prepared', 'legacy')));
		assert.equal(await service.accountDomain('prepared'), 'PREPARED');
		assert.equal(
			(await client.foundationEnrollment.findUnique({ where: { userId: 'prepared' } })).epoch,
			1
		);
	});
	await test('missing account cannot leave orphaned enrollment', async () => {
		await assert.rejects(service.prepareFoundationAccount('missing'), /Account unavailable/);
		assert.equal(await client.foundationEnrollment.count({ where: { userId: 'missing' } }), 0);
	});
	await test('failure after vault creation rolls back the entire preparation', async () => {
		await db.exec(
			`CREATE FUNCTION f203_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."ownerUserId" = 'rollback' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER f203_test_fail BEFORE INSERT ON "FoundationSubject" FOR EACH ROW EXECUTE FUNCTION f203_test_fail();`
		);
		await assert.rejects(service.prepareFoundationAccount('rollback'));
		assert.equal(await client.foundationEnrollment.count({ where: { userId: 'rollback' } }), 0);
		assert.equal(await client.foundationVault.count({ where: { ownerUserId: 'rollback' } }), 0);
		await db.exec(
			'DROP TRIGGER f203_test_fail ON "FoundationSubject"; DROP FUNCTION f203_test_fail();'
		);
	});
	await test('locked vault and archived self fail closed before session issuance', async () => {
		await service.prepareFoundationAccount('broken');
		await client.foundationVault.updateMany({
			where: { ownerUserId: 'broken' },
			data: { state: 'LOCKED' }
		});
		await assert.rejects(auth.createSession('broken'), /unavailable/);
		assert.equal(await client.session.count({ where: { userId: 'broken' } }), 0);
		await service.prepareFoundationAccount('archived');
		await client.foundationSubject.update({
			where: { selfUserId: 'archived' },
			data: { state: 'ARCHIVED' }
		});
		await assert.rejects(auth.createSession('archived'), /unavailable/);
		assert.equal(await client.session.count({ where: { userId: 'archived' } }), 0);
	});
	await test('active session requires existing roots; suspended login does not repair or reactivate', async () => {
		await service.prepareFoundationAccount('active');
		await client.foundationEnrollment.update({
			where: { userId: 'active' },
			data: { state: 'ACTIVE', epoch: 2 }
		});
		await auth.createSession('active');
		await client.foundationEnrollment.create({ data: { userId: 'suspended', state: 'SUSPENDED' } });
		await auth.createSession('suspended');
		assert.equal(await client.foundationVault.count({ where: { ownerUserId: 'suspended' } }), 0);
		await assert.rejects(service.prepareFoundationAccount('active'), /not prepared/);
		await assert.rejects(service.prepareFoundationAccount('suspended'), /not prepared/);
	});
	await test('all enrollment states skip the real email/phone/LinkedIn linker before legacy reads', async () => {
		// There are deliberately no Lead or ContextSpace tables: any accidental legacy call fails.
		for (const id of ['prepared', 'active', 'suspended']) {
			assert.deepEqual(
				await linker.linkLeadsForUserFlexible(id, {
					email: 'synthetic@example.test',
					phone: '123',
					linkedinUrl: 'https://linkedin.com/in/test'
				}),
				{ claimedLeadIds: [], touchedContactIds: [], owners: [] }
			);
			await linker.linkLeadsForUser(id, 'synthetic@example.test');
		}
		const result = await service.withLegacyAccountClaims(
			'legacy',
			async (tx) => {
				// A one-connection pool proves the callback uses the same transaction connection.
				return (await tx.user.findUnique({ where: { id: 'legacy' }, select: { id: true } })).id;
			},
			'skipped'
		);
		assert.equal(result, 'legacy');
	});
	await test('private routing permits legacy/prepared and rejects active/suspended without fallback', async () => {
		for (const id of ['legacy', 'prepared']) await service.requireLegacyPeopleDomain(id);
		for (const id of ['active', 'suspended'])
			await assert.rejects(service.requireLegacyPeopleDomain(id), (e) => e.status === 503);
	});
	await test('concurrent preparation produces exactly one root', { skip: !endpoint }, async () => {
		await db.exec(`INSERT INTO "User" VALUES ('parallel')`);
		const roots = await Promise.all(
			Array.from({ length: 4 }, () => service.prepareFoundationAccount('parallel'))
		);
		for (const root of roots) assert.deepEqual(root, roots[0]);
		assert.equal(await client.foundationVault.count({ where: { ownerUserId: 'parallel' } }), 1);
		assert.equal(await client.foundationSubject.count({ where: { selfUserId: 'parallel' } }), 1);
	});
	await test(
		'preparation waits for an in-flight legacy claim and subsequent claims skip',
		{ skip: !endpoint },
		async () => {
			await db.exec(`INSERT INTO "User" VALUES ('race')`);
			let entered, release;
			const ready = new Promise((r) => (entered = r)),
				gate = new Promise((r) => (release = r));
			let pending;
			const claim = service.withLegacyAccountClaims(
				'race',
				async (tx) => {
					const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
					entered(pid);
					await gate;
					return 'legacy';
				},
				'skipped'
			);
			const blocker = await ready;
			try {
				pending = service.prepareFoundationAccount('race');
				// Observe an actual blocked database writer instead of inferring a race from elapsed time.
				const deadline = Date.now() + 4000;
				let blocked = false;
				while (Date.now() < deadline) {
					const result = await db.observer.query(
						'SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))) AS blocked',
						[blocker]
					);
					if (result.rows[0].blocked) {
						blocked = true;
						break;
					}
					await new Promise((r) => setTimeout(r, 20));
				}
				assert.equal(blocked, true);
			} finally {
				release();
				await claim;
				if (pending) await pending;
			}
			assert.equal(
				await service.withLegacyAccountClaims(
					'race',
					async () => assert.fail('legacy fallback'),
					'skipped'
				),
				'skipped'
			);
		}
	);
	await test('lookup failures do not execute a legacy callback', async () => {
		let called = false;
		await assert.rejects(
			service.withLegacyAccountClaims(
				'',
				async () => {
					called = true;
				},
				undefined
			)
		);
		assert.equal(called, false);
	});
} finally {
	if (vite) await vite.close();
	if (client) await client.$disconnect();
	if (socket) await socket.stop();
	await db.close();
	delete globalThis.__f203client;
}
