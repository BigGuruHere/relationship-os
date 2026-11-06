// Exercise the existing owner page, login and private People routes on a disposable database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createServer } from 'vite';
import { legacySchemaFixture } from './legacy-schema-fixture.mjs';

test('P-306 owner creates one fresh foundation login for DEV', { timeout: 120000 }, async (t) => {
	const db = await PGlite.create({ extensions: { vector } });
	let socket, vite, prisma;
	try {
		const { legacySql, defaultTrigger } = await legacySchemaFixture(
			await readFile('prisma/schema.prisma', 'utf8')
		);
		await db.exec('CREATE EXTENSION vector');
		await db.exec(legacySql);
		await db.exec(defaultTrigger);
		await db.exec(
			await readFile(
				'prisma/migrations/20261104010000_f202_foundation_schema/migration.sql',
				'utf8'
			)
		);
		await db.exec(`INSERT INTO "User" (id,"updatedAt",role) VALUES ('owner',now(),'owner'),('member',now(),'member');
			INSERT INTO "Profile"(id,"userId",slug,"updatedAt") VALUES ('legacy-card','owner','legacy-owner',now());`);
		socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 1 });
		await socket.start();
		process.env.DATABASE_URL =
			'postgresql://postgres:postgres@' + socket.getServerConn() + '/postgres?connection_limit=1';
		process.env.SECRET_MASTER_KEY = 'a'.repeat(64);
		process.env.SESSION_COOKIE_SECRET = 'synthetic-only-session-key-for-P306';
		process.env.SESSION_DAYS = '7';
		process.env.LOGIN_THROTTLE_SECRET = 'synthetic-only-throttle-key-for-P306';
		process.env.DB_KEEPALIVE_ENABLED = 'NO';
		process.env.APP_ORIGIN_DEV = 'https://dev.relish.live';
		const target = socket.getServerConn() + '/postgres';
		delete process.env.RELISH_DEV_FOUNDATION_PILOT_TARGET;

		vite = await createServer({
			configFile: false,
			server: { middlewareMode: true, hmr: false },
			resolve: { alias: { $lib: resolve('src/lib') } },
			plugins: [
				{
					name: 'synthetic-svelte-environment',
					resolveId: (id) => (id === '$app/environment' ? '\0p306-env' : undefined),
					load: (id) => (id === '\0p306-env' ? 'export const dev=true;' : undefined)
				}
			]
		});
		const load = (path) => vite.ssrLoadModule('/src/' + path + '.ts');
		({ prisma } = await load('lib/db'));
		const accountPage = await load('routes/settings/users/+page.server');
		const loginPage = await load('routes/auth/login/+page.server');
		const profilesPage = await load('routes/settings/profile/+page.server');
		const capturePage = await load('routes/u/[slug]/share-details/+page.server');
		const notePage = await load('routes/people/[id]/notes/new/+page.server');
		const personPage = await load('routes/people/[id]/+page.server');
		const provision = await load('lib/server/foundation/provisioning');
		const { getSessionFromCookie } = await load('lib/auth');
		const { sessionCookieConfig } = await load('lib/cookies');
		const { devPilotEnabled } = await load('lib/server/foundation/devPilotGate');
		const origin = 'https://dev.relish.live';
		const pageUrl = new URL(origin + '/settings/users?/createFoundationTest');
		const owner = { env: 'dev', appOrigin: origin, user: { id: 'owner', role: 'owner' } };
		const password = 'fixture-password-long-enough-42';
		const count = async (table) =>
			(await db.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n;
		const totals = async () =>
			Object.fromEntries(
				await Promise.all(
					[
						'User',
						'Person',
						'Profile',
						'ContextSpace',
						'FoundationEnrollment',
						'FoundationVault',
						'FoundationSubject'
					].map(async (table) => [table, await count(table)])
				)
			);
		const submit = (locals = owner, sentOrigin = origin, url = pageUrl, value = password) =>
			accountPage.actions.createFoundationTest({
				locals,
				url,
				request: new Request(url, {
					method: 'POST',
					headers: { origin: sentOrigin },
					body: new URLSearchParams({ pilotPassword: value, userId: 'member', role: 'owner' })
				})
			});

		await t.test(
			'flag, exact DEV origin and DB target, and authenticated owner all gate the control',
			async () => {
				const before = await totals();
				const page = await accountPage.load({ locals: owner, url: pageUrl, setHeaders() {} });
				assert.equal(page.pilotEnabled, false);
				await assert.rejects(submit(), (e) => e.status === 404);
				process.env.RELISH_DEV_FOUNDATION_PILOT_TARGET = 'different.example.invalid/postgres';
				await assert.rejects(submit(), (e) => e.status === 404);
				process.env.RELISH_DEV_FOUNDATION_PILOT_TARGET = target;
				await assert.rejects(submit({ ...owner, env: 'prod' }), (e) => e.status === 404);
				const spoof = new URL('https://other.example.test/settings/users?/createFoundationTest');
				await assert.rejects(submit(owner, spoof.origin, spoof), (e) => e.status === 404);
				await assert.rejects(submit(owner, 'https://evil.example.test'), (e) => e.status === 403);
				await assert.rejects(submit({ ...owner, user: undefined }), (e) => e.status === 303);
				await assert.rejects(
					submit({ ...owner, user: { id: 'member', role: 'member' }, capabilities: ['ADMIN'] }),
					(e) => e.status === 403
				);
				// A stale owner session cannot bypass the database recheck.
				await assert.rejects(
					submit({ ...owner, user: { id: 'member', role: 'owner' } }),
					(e) => e.status === 403
				);
				assert.equal((await submit(owner, origin, pageUrl, 'too short')).status, 400);
				assert.deepEqual(await totals(), before);

				// Direct target notation matches a pooled Neon URL. Options selecting another
				// schema or connection destination cannot make that URL eligible.
				const realUrl = process.env.DATABASE_URL;
				try {
					process.env.RELISH_DEV_FOUNDATION_PILOT_TARGET = 'ep-fixture.example.test/neondb';
					process.env.DATABASE_URL =
						'postgresql://u:p@ep-fixture-pooler.example.test/neondb?sslmode=require';
					assert.equal(devPilotEnabled(owner, origin), true);
					for (const suffix of ['&schema=other', '&host=other.example.test', '&sslmode=disable']) {
						process.env.DATABASE_URL =
							'postgresql://u:p@ep-fixture-pooler.example.test/neondb?sslmode=require' + suffix;
						assert.equal(devPilotEnabled(owner, origin), false);
					}
				} finally {
					process.env.DATABASE_URL = realUrl;
					process.env.RELISH_DEV_FOUNDATION_PILOT_TARGET = target;
				}
			}
		);
		await t.test(
			'failure after creating the account and vault rolls back every new record',
			async () => {
				const before = await totals();
				await db.exec(`CREATE FUNCTION fail_dev_pilot() RETURNS trigger LANGUAGE plpgsql AS $$
				BEGIN RAISE EXCEPTION 'fixture-sensitive-storage-error'; END $$;
				CREATE TRIGGER fail_dev_pilot BEFORE INSERT ON "FoundationEnrollment" FOR EACH ROW EXECUTE FUNCTION fail_dev_pilot();`);
				const original = console.error;
				const logs = [];
				console.error = (value) => logs.push(value);
				try {
					const result = await submit();
					assert.equal(result.status, 503);
					assert.doesNotMatch(
						logs.join(' '),
						/fixture-sensitive-storage-error|fixture-password|@example.invalid/
					);
					assert.ok(result.data.error.includes(JSON.parse(logs[0]).reference));
					assert.deepEqual(await totals(), before);
				} finally {
					console.error = original;
					await db.exec(
						'DROP TRIGGER fail_dev_pilot ON "FoundationEnrollment"; DROP FUNCTION fail_dev_pilot()'
					);
				}
			}
		);
		let email, pilotId, profile;
		await t.test(
			'overlapping submissions create one fresh member and an unpublished profile in ACTIVE',
			async () => {
				const responses = await Promise.allSettled([submit(), submit()]);
				const successes = responses.filter((r) => r.status === 'fulfilled');
				const failures = responses.filter((r) => r.status === 'rejected');
				assert.equal(successes.length, 1);
				assert.equal(failures.length, 1);
				assert.equal(failures[0].reason.status, 409);
				email = successes[0].value.pilotEmail;
				assert.match(email, /^foundation-[0-9a-f-]+@example\.invalid$/);
				assert.doesNotMatch(JSON.stringify(successes[0].value), /fixture-password/);
				const rows = (
					await db.query(
						`SELECT id,role,"passwordHash","email_Enc" FROM "User" WHERE id LIKE 'p306-dev-pilot-%'`
					)
				).rows;
				assert.equal(rows.length, 1);
				pilotId = rows[0].id;
				assert.equal(rows[0].role, 'member');
				assert.match(rows[0].passwordHash, /^\$argon2id\$/);
				assert.ok(!rows[0].email_Enc.includes(email));
				assert.equal(await provision.accountDomain(pilotId), 'ACTIVE');
				assert.equal(await provision.accountDomain('owner'), 'LEGACY');
				assert.equal(await provision.accountDomain('member'), 'LEGACY');
				assert.equal(await count('FoundationVault'), 1);
				assert.equal(await count('FoundationSubject'), 1);
				profile = (
					await db.query('SELECT id,slug,"isPublished" FROM "Profile" WHERE "userId"=$1', [pilotId])
				).rows[0];
				assert.equal(profile.isPublished, false);
				const page = await accountPage.load({ locals: owner, url: pageUrl, setHeaders() {} });
				assert.equal(page.pilotEmail, email);
			}
		);

		await t.test(
			'normal password login, profile publication, capture, notes and archive use the new vault',
			async () => {
				const map = new Map();
				const cookies = {
					get: (k) => map.get(k),
					set: (k, v) => map.set(k, v),
					delete: (k) => map.delete(k)
				};
				const sessionCookie = sessionCookieConfig('dev');
				const login = new URL(origin + '/auth/login');
				await assert.rejects(
					loginPage.actions.default({
						locals: { sessionCookie },
						cookies,
						url: login,
						getClientAddress: () => '127.0.0.1',
						request: new Request(login, {
							method: 'POST',
							body: new URLSearchParams({ email, password })
						})
					}),
					(e) => e.status === 303
				);
				const session = await getSessionFromCookie(cookies.get(sessionCookie.name));
				assert.equal(session.user.id, pilotId);
				const locals = {
					appOrigin: origin,
					env: 'dev',
					user: { id: session.user.id, role: session.user.role }
				};
				const edit = new URL(origin + '/settings/profile?/save');
				await assert.rejects(
					profilesPage.actions.save({
						locals,
						cookies,
						url: edit,
						request: new Request(edit, {
							method: 'POST',
							body: new URLSearchParams({
								profileId: profile.id,
								displayName: 'Relish foundation test',
								kind: 'business',
								isPublished: 'on'
							})
						})
					}),
					(e) => e.status === 303 && e.location === '/share?profile=' + profile.slug
				);

				const publicUrl = new URL(origin + '/u/' + profile.slug + '/share-details?via=qr');
				const event = {
					params: { slug: profile.slug },
					locals: {},
					url: publicUrl,
					cookies,
					setHeaders() {}
				};
				const capture = await capturePage.load(event);
				const result = await capturePage.actions.default({
					...event,
					request: new Request(publicUrl, {
						method: 'POST',
						headers: { origin },
						body: new URLSearchParams({
							name: 'Fixture visitor',
							contactConsent: 'yes',
							captureToken: capture.captureToken
						})
					})
				});
				assert.equal(result.shared, true);
				assert.equal(await count('Contact'), 0);
				assert.equal(await count('Interaction'), 0);
				const person = (
					await db.query(
						'SELECT id FROM "FoundationSubject" WHERE "selfUserId" IS NULL AND "ownerUserId"=$1',
						[pilotId]
					)
				).rows[0];
				const params = { id: person.id };
				const note = await notePage.load({ locals, params });
				const noteUrl = new URL(origin + '/people/' + person.id + '/notes/new?/save');
				await assert.rejects(
					notePage.actions.save({
						locals,
						params,
						request: new Request(noteUrl, {
							method: 'POST',
							body: new URLSearchParams({ text: 'Fixture note', saveKey: note.saveKey })
						})
					}),
					(e) => e.status === 303
				);
				const detail = await personPage.load({
					locals,
					params,
					url: new URL(origin + '/people/' + person.id)
				});
				assert.equal(detail.contact.name, 'Fixture visitor');
				assert.equal(detail.notes[0].text, 'Fixture note');
				assert.equal(detail.foundation, true);
				assert.equal(await count('Interaction'), 0);
				await assert.rejects(
					personPage.actions.archive({ locals, params }),
					(e) => e.status === 303
				);
				await assert.rejects(
					personPage.load({ locals, params, url: noteUrl }),
					(e) => e.status === 404
				);
			}
		);
		await t.test(
			'only the verified synthetic vault can be erased and replayed after restore',
			async () => {
				const run = promisify(execFile);
				const script = 'scripts/foundation-dev-pilot-replay.ts';
				const clone =
					(database, conn) =>
					async (command, overrides = {}) => {
						// The embedded socket shares a session across Prisma clients.
						await database.exec('DEALLOCATE ALL');
						return run(process.execPath, ['--import', 'tsx', script, command], {
							env: {
								...process.env,
								DATABASE_URL:
									'postgresql://postgres:postgres@' + conn + '/postgres?connection_limit=1',
								P305_EXPECTED_TARGET: conn + '/postgres',
								P306_SOURCE_TARGET: 'dev.example.invalid/postgres',
								P306_CONFIRM: '',
								...overrides
							}
						});
					};
				const json = async (result) => JSON.parse((await result).stdout);
				const failsAt = (stage) => (error) =>
					error.stdout === '' &&
					JSON.parse(error.stderr).stage === stage &&
					!/fixture note|@example\.invalid|postgresql:\/\//i.test(error.stderr);

				await prisma.$disconnect();
				const execute = clone(db, socket.getServerConn());
				const first = await execute('inspect');
				assert.doesNotMatch(first.stdout, /fixture note|fixture visitor|@example\.invalid/i);
				const before = JSON.parse(first.stdout);
				assert.equal(before.verified, 'ready');
				assert.equal(before.enrollment, 'ACTIVE');
				assert.equal(before.counts.sourceVersions, 2); // Exchange receipt and private note.
				assert.match(before.proof, /^[a-f0-9]{64}$/);
				const confirmation = { P306_CONFIRM: 'erase-test-copy:' + before.proof };

				await assert.rejects(
					execute('replay', { ...confirmation, P306_SOURCE_TARGET: target }),
					failsAt('target')
				);
				await assert.rejects(
					execute('replay', { ...confirmation, SECRET_MASTER_KEY: 'b'.repeat(64) }),
					failsAt('pilot-identity')
				);
				await assert.rejects(
					execute('replay', { P306_CONFIRM: 'erase-test-copy:' + '0'.repeat(64) }),
					failsAt('proof')
				);
				assert.deepEqual(await json(execute('inspect')), before);

				// Replay the same proof on a fresh copy of the saved pre-erasure data.
				const snapshot = await db.dumpDataDir();
				const result = await json(execute('replay', confirmation));
				assert.equal(result.verified, 'erased');
				assert.equal(result.enrollment, 'SUSPENDED');
				assert.equal(result.vault, 'LOCKED');
				assert.ok(result.erasedRows > 0);
				assert.ok(Object.values(result.counts).every((value) => value === 0));
				assert.equal((await json(execute('inspect'))).verified, 'erased');
				assert.equal(await count('User'), 3);
				assert.equal(await count('Profile'), 2);

				const restored = await PGlite.create({ loadDataDir: snapshot, extensions: { vector } });
				const restoredSocket = new PGLiteSocketServer({
					db: restored,
					host: '127.0.0.1',
					port: 0,
					maxConnections: 1
				});
				try {
					await restoredSocket.start();
					const replay = clone(restored, restoredSocket.getServerConn());
					assert.deepEqual(await json(replay('inspect')), before);
					assert.deepEqual(await json(replay('replay', confirmation)), result);
				} finally {
					await restoredSocket.stop();
					await restored.close();
				}
			}
		);
	} finally {
		if (prisma) await prisma.$disconnect();
		if (vite) await vite.close();
		if (socket) await socket.stop();
		await db.close();
		delete globalThis.prisma;
	}
});
