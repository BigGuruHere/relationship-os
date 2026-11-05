// Integration proof against the actual shared Prisma guard and repository code.
// Only synthetic PGlite or an explicitly named empty loopback PostgreSQL database is used.
import test from 'node:test';
import { exerciseEvidence } from './f205-evidence-cases.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createServer } from 'vite';
process.env.SECRET_MASTER_KEY = 'a'.repeat(64);
process.env.DB_KEEPALIVE_ENABLED = 'NO';
const endpoint = process.env.F204_TEST_DATABASE_URL;
let db, socket, vite, prisma;
if (endpoint) {
	const url = new URL(endpoint);
	assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
	assert.match(url.pathname, /^\/relish_f204_[a-z0-9_]+$/);
	const { Client } = await import('pg');
	const c = new Client({ connectionString: endpoint });
	await c.connect();
	assert.equal(
		(
			await c.query(
				"SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'"
			)
		).rows[0].n,
		0
	);
	db = { exec: (sql) => c.query(sql), close: () => c.end(), observer: c };
} else db = new PGlite();
try {
	await db.exec(
		"CREATE TABLE \"User\" (id text PRIMARY KEY); INSERT INTO \"User\" VALUES ('alice'),('bob'),('legacy');"
	);
	await db.exec(
		await readFile('prisma/migrations/20261104010000_f202_foundation_schema/migration.sql', 'utf8')
	);
	if (!endpoint) {
		socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 1 });
		await socket.start();
	}
	process.env.DATABASE_URL = endpoint
		? endpoint + '?connection_limit=5'
		: 'postgresql://postgres:postgres@' + socket.getServerConn() + '/postgres?connection_limit=1';
	vite = await createServer({
		configFile: false,
		server: { middlewareMode: true },
		resolve: { alias: { $lib: resolve('src/lib') } }
	});
	({ prisma } = await vite.ssrLoadModule('/src/lib/db.ts'));
	const provision = await vite.ssrLoadModule('/src/lib/server/foundation/provisioning.ts');
	const policy = await vite.ssrLoadModule('/src/lib/server/foundation/policy.ts');
	const subjects = await vite.ssrLoadModule('/src/lib/server/foundation/subjects.ts');
	const crypto = await vite.ssrLoadModule('/src/lib/crypto.ts');
	const alice = await provision.prepareFoundationAccount('alice');
	const bob = await provision.prepareFoundationAccount('bob');
	const locals = (id) => ({ user: { id } });
	const access = (id, op) => policy.resolvePreparedFoundationAccess(locals(id), op);
	const aw = await access('alice', 'WRITE'),
		ar = await access('alice', 'READ'),
		bw = await access('bob', 'WRITE'),
		br = await access('bob', 'READ');
	let person, other, relationship;
	await test('shared Prisma denies direct foundation reads/writes/bulk operations and transactions', async () => {
		for (const call of [
			() => prisma.foundationSubject.findMany(),
			() => prisma.foundationSubject.count(),
			() => prisma.foundationSubject.deleteMany(),
			() => prisma.foundationSubject.createMany({ data: [] }),
			() => prisma.$transaction((tx) => tx.foundationSubject.findMany())
		])
			await assert.rejects(call, /Foundation resource unavailable/);
		assert.deepEqual(await prisma.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } }), [
			{ id: 'alice' },
			{ id: 'bob' },
			{ id: 'legacy' }
		]);
		assert.equal(await provision.accountDomain('legacy'), 'LEGACY');
		assert.equal(
			await provision.withLegacyAccountClaims(
				'legacy',
				async (tx) =>
					(await tx.user.findUnique({ where: { id: 'legacy' }, select: { id: true } })).id,
				'skip'
			),
			'legacy'
		);
	});
	await test('legacy nested traversal, counts, filters and writes cannot enter foundation', async () => {
		for (const args of [
			{ select: { f202VaultOwner: true } },
			{ select: { _count: { select: { f202VaultOwner: true } } } },
			{ where: { f202VaultOwner: { some: {} } } },
			{ include: { f202EnrollmentUser: true } }
		])
			await assert.rejects(prisma.user.findMany(args), /Foundation resource unavailable/);
		await assert.rejects(
			prisma.user.update({ where: { id: 'alice' }, data: { f202VaultOwner: { deleteMany: {} } } }),
			/Foundation resource unavailable/
		);
		await assert.rejects(
			prisma.$queryRaw`SELECT * FROM "FoundationSubject"`,
			/Foundation resource unavailable/
		);
		await assert.rejects(
			prisma.$queryRawUnsafe('SELECT * FROM "FoundationSubject"'),
			/Foundation resource unavailable/
		);
		assert.equal((await prisma.$queryRaw`SELECT 1 AS n`)[0].n, 1);
	});
	await test('authentication, cohort, operation and runtime capability are required', async () => {
		await assert.rejects(policy.resolveFoundationAccess({}, 'READ'), /unavailable/);
		await assert.rejects(policy.resolveFoundationAccess(locals('legacy'), 'READ'), /unavailable/);
		await assert.rejects(policy.resolveFoundationAccess(locals('alice'), 'READ'), /unavailable/);
		await assert.rejects(
			policy.resolvePreparedFoundationAccess(locals('alice'), 'DISCLOSE'),
			/unavailable/
		);
		for (const forged of [{ ...aw }, { ...aw, ownerUserId: 'bob' }, JSON.parse(JSON.stringify(aw))])
			await assert.rejects(subjects.createPerson(forged, 'X'), /unavailable/);
		await assert.rejects(subjects.createPerson(ar, 'X'), /unavailable/);
	});
	await test('repository scope rejects forged custody, nested access, bulk and raw bypasses', async () => {
		const calls = [
			(tx) =>
				tx.foundationSubject.create({
					data: {
						ownerUserId: 'bob',
						vaultId: alice.vaultId,
						kind: 'PERSON',
						displayNameEnc: 'bad'
					}
				}),
			(tx) =>
				tx.foundationSubject.create({
					data: {
						ownerUserId: 'alice',
						vaultId: bob.vaultId,
						kind: 'PERSON',
						displayNameEnc: 'bad'
					}
				}),
			(tx) => tx.foundationSubject.findMany({ include: { vault: true } }),
			(tx) =>
				tx.foundationSubject.update({
					where: { id: alice.selfSubjectId },
					data: { ownerUserId: 'bob' }
				}),
			(tx) => tx.foundationSubject.deleteMany(),
			(tx) => tx.foundationSource.findMany(),
			(tx) => tx.$queryRawUnsafe('SELECT * FROM "FoundationSubject"')
		];
		for (const call of calls)
			await assert.rejects(policy.withFoundationAccess(aw, 'WRITE', call), /unavailable/);
		assert.deepEqual(
			await policy.withFoundationAccess(ar, 'READ', (tx) =>
				tx.foundationSubject.findMany({
					where: { OR: [{ ownerUserId: 'bob' }, { vaultId: bob.vaultId }] }
				})
			),
			[]
		);
		// Async descendants must not retain authority after their repository transaction finishes.
		let release;
		const gate = new Promise((r) => (release = r));
		let delayed;
		await policy.withFoundationAccess(ar, 'READ', async () => {
			delayed = (async () => {
				await gate;
				return prisma.foundationSubject.findMany();
			})();
		});
		release();
		await assert.rejects(delayed, /unavailable/);
		const escaped = await policy.withFoundationAccess(ar, 'READ', async (tx) => tx);
		await assert.rejects(escaped.foundationSubject.findMany());
	});
	await test('private directory encrypts per row/custody and scopes read/list', async () => {
		person = await subjects.createPerson(aw, 'Betty');
		other = await subjects.createPerson(bw, 'Betty');
		assert.notEqual(person.id, other.id);
		assert.equal((await subjects.readSubject(ar, person.id)).name, 'Betty');
		assert.deepEqual(Object.keys(person).sort(), ['id', 'isSelf', 'kind', 'name', 'state']);
		for (const id of [other.id, 'missing'])
			await assert.rejects(subjects.readSubject(ar, id), /Foundation resource unavailable/);
		assert.ok(!(await subjects.listPeople(ar)).items.some((p) => p.id === other.id));
		const result = await db.exec(
			`SELECT "displayNameEnc" FROM "FoundationSubject" WHERE id='${person.id}'`
		);
		const row = (Array.isArray(result) ? result[0].rows : result.rows)[0];
		assert.notEqual(row.displayNameEnc, 'Betty');
		assert.throws(() =>
			crypto.decrypt(
				row.displayNameEnc,
				`foundation:v1:FoundationSubject:displayNameEnc:bob:${bob.vaultId}:${person.id}`
			)
		);
	});
	await test('relationships validate typed same-owner members atomically and disclose only to owner', async () => {
		for (const ids of [[person.id], [person.id, other.id], [person.id, person.id]])
			await assert.rejects(subjects.createRelationship(aw, 'Private', ids));
		relationship = await subjects.createRelationship(aw, 'Private relationship', [
			person.id,
			alice.selfSubjectId
		]);
		const read = await subjects.readRelationship(ar, relationship.id);
		assert.equal(read.members.length, 2);
		await assert.rejects(subjects.readRelationship(br, relationship.id), /unavailable/);
		await assert.rejects(
			subjects.createRelationship(aw, 'Invalid', [person.id, relationship.id]),
			/unavailable/
		);
		assert.equal(
			(await subjects.createRelationship(aw, 'Group', [person.id], 'GROUP')).kind,
			'GROUP'
		);
	});
	await test('perspective attribution and archive never confer access or erase self', async () => {
		await assert.rejects(
			subjects.createPerspective(aw, 'ATTRIBUTED_PERSON', other.id),
			/unavailable/
		);
		await assert.rejects(
			subjects.createPerspective(aw, 'ATTRIBUTED_PERSON', relationship.id),
			/unavailable/
		);
		assert.equal(
			(await subjects.createPerspective(aw, 'ATTRIBUTED_PERSON', person.id)).holderSubjectId,
			person.id
		);
		await assert.rejects(subjects.createPerspective(aw, 'JOINT'), /Invalid/);
		await assert.rejects(subjects.archiveSubject(aw, alice.selfSubjectId), /unavailable/);
		await subjects.archiveSubject(aw, person.id);
		await assert.rejects(subjects.readSubject(ar, person.id), /unavailable/);
		assert.equal((await subjects.readRelationship(ar, relationship.id)).members.length, 1);
	});
	await test('stale epochs, suspended enrollment and locked vault invalidate previously issued handles', async () => {
		await db.exec(`UPDATE "FoundationEnrollment" SET epoch=epoch+1 WHERE "userId"='alice'`);
		await assert.rejects(subjects.listPeople(ar), /unavailable/);
		await assert.rejects(subjects.createPerson(aw, 'Stale'), /unavailable/);
		const fresh = await access('alice', 'WRITE');
		await db.exec(`UPDATE "FoundationVault" SET state='LOCKED' WHERE "ownerUserId"='alice'`);
		await assert.rejects(subjects.createPerson(fresh, 'Locked'), /unavailable/);
		await db.exec(
			`UPDATE "FoundationVault" SET state='ACTIVE' WHERE "ownerUserId"='alice'; UPDATE "FoundationEnrollment" SET state='SUSPENDED',epoch=epoch+1 WHERE "userId"='alice'`
		);
		await assert.rejects(subjects.createPerson(fresh, 'Suspended'), /unavailable/);
		await db.exec(
			`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1 WHERE "userId"='alice'`
		);
		const active = await policy.resolveFoundationAccess(locals('alice'), 'READ');
		assert.ok((await subjects.listPeople(active)).items.length);
		await assert.rejects(access('alice', 'READ'), /unavailable/);
	});
	await test(
		'capability expires after epoch transition racing an in-flight transaction',
		{ skip: !endpoint },
		async () => {
			const active = await policy.resolveFoundationAccess(locals('alice'), 'READ');
			let entered, release;
			const ready = new Promise((r) => (entered = r)),
				gate = new Promise((r) => (release = r));
			const reading = policy.withFoundationAccess(active, 'READ', async () => {
				entered();
				await gate;
			});
			await ready;
			const { Client } = await import('pg');
			const transition = new Client({ connectionString: endpoint });
			await transition.connect();
			let pending;
			try {
				await transition.query('BEGIN');
				pending = transition.query(
					"SELECT pg_advisory_xact_lock(hashtextextended('foundation:account:alice',0))"
				);
				let blocked = false;
				const deadline = Date.now() + 4000;
				while (Date.now() < deadline) {
					const r = await db.observer.query(
						'SELECT cardinality(pg_blocking_pids($1))>0 AS blocked',
						[transition.processID]
					);
					if (r.rows[0].blocked) {
						blocked = true;
						break;
					}
					await new Promise((r) => setTimeout(r, 20));
				}
				assert.equal(blocked, true);
				release();
				await reading;
				await pending;
				await transition.query(
					`UPDATE "FoundationEnrollment" SET state='SUSPENDED',epoch=epoch+1 WHERE "userId"='alice'`
				);
				await transition.query('COMMIT');
				await assert.rejects(subjects.listPeople(active), /unavailable/);
			} finally {
				release();
				await reading;
				await transition.query('ROLLBACK');
				await transition.end();
			}
		}
	);
	await test(
		'an in-flight handoff fences a stale legacy capture decision',
		{ skip: !endpoint },
		async () => {
			const owner = 'capture-race';
			await db.exec(`INSERT INTO "User" VALUES ('capture-race')`);
			await provision.prepareFoundationAccount(owner);
			await provision.requireLegacyPeopleDomain(owner);
			const { Client } = await import('pg');
			const transition = new Client({ connectionString: endpoint });
			await transition.connect();
			let outcome;
			try {
				await transition.query('BEGIN');
				await transition.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
					'foundation:account:' + owner
				]);
				await transition.query(
					`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1 WHERE "userId"=$1`,
					[owner]
				);
				// Observe the actual lock wait before committing, then check what the writer sees.
				outcome = prisma
					.$transaction(async (tx) => {
						await provision.requireLegacyPeopleDomain(owner, tx);
						return 'legacy writer admitted';
					})
					.then(
						(value) => value,
						(error) => error.status
					);
				const deadline = Date.now() + 4000;
				let blocked = false;
				while (Date.now() < deadline) {
					const result = await db.observer.query(
						'SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS blocked',
						[transition.processID]
					);
					if (result.rows[0].blocked) {
						blocked = true;
						break;
					}
					await new Promise((resolve) => setTimeout(resolve, 20));
				}
				assert.equal(blocked, true);
				await transition.query('COMMIT');
				assert.equal(await outcome, 503);
			} finally {
				await transition.query('ROLLBACK');
				await transition.end();
				if (outcome) await outcome;
			}
		}
	);
	await exerciseEvidence({ vite, db, endpoint });
} finally {
	if (prisma) await prisma.$disconnect();
	if (vite) await vite.close();
	if (socket) await socket.stop();
	await db.close();
	delete globalThis.prisma;
}
