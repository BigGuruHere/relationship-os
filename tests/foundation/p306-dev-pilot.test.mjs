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

test('Internal DEV setup and ordinary Foundation signup on an isolated database', { timeout: 120000 }, async (t) => {
	const db = await PGlite.create({ extensions: { vector } });
	let socket, vite, prisma;
	try {
		const { legacySql, defaultTrigger } = await legacySchemaFixture(
			// Reconstruct the pre-S402 legacy schema; that migration creates this index.
			(await readFile('prisma/schema.prisma', 'utf8')).replace(
				/^.*@@unique.*s402_profile_scope.*\n/gm,
				''
			)
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
		for (const name of [
			'20261107010000_s402_exchange_claims',
			'20261107020000_s402b_exchange_service',
            '20261107030000_s405c_account_channels',
            '20261108010000_s405d_guest_assurance'
		]) {
			await db.exec(await readFile('prisma/migrations/' + name + '/migration.sql', 'utf8'));
		}

		process.env.DATABASE_URL =
			'postgresql://postgres:postgres@' + socket.getServerConn() + '/postgres?connection_limit=1';
		process.env.SECRET_MASTER_KEY = 'a'.repeat(64);
		process.env.SESSION_COOKIE_SECRET = 'synthetic-only-session-key-for-P306';
		process.env.SESSION_DAYS = '7';
		process.env.LOGIN_THROTTLE_SECRET = 'synthetic-only-throttle-key-for-P306';
		process.env.DB_KEEPALIVE_ENABLED = 'NO';
		process.env.APP_ORIGIN_DEV = 'https://dev.relish.live';
		for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OAUTH_REDIRECT_URI'])
			process.env[name] = 'synthetic-google-config';
		const target = socket.getServerConn() + '/postgres';
		delete process.env.RELISH_DEV_FOUNDATION_PILOT_TARGET;

		vite = await createServer({
			configFile: false,
			ssr: { noExternal: ['jose'] },
			server: { middlewareMode: true, hmr: false },
			resolve: { alias: { $lib: resolve('src/lib') } },
			plugins: [
				{
					name: 'synthetic-svelte-environment',
					enforce: 'pre',
					resolveId(id) {
						if (id === '$app/environment') return '\0p306-env';
						if (id === 'jose') return '\0p306-google';
					},
					load(id) {
						if (id === '\0p306-env') return 'export const dev=true;';
						if (id === '\0p306-google') return `
							export const createRemoteJWKSet = () => ({});
							export async function jwtVerify() { return { payload: globalThis.__p306Google }; }
						`;
					}
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
		await t.test('owner can create the second DEV fixture but cannot exceed two', async () => {
			const before = await count('User');
			await provision.createDevPilotAccount(owner, origin, 'fixture-only-hash', 2);
			assert.equal(await count('User'), before + 1);
			await assert.rejects(
				provision.createDevPilotAccount(owner, origin, 'fixture-only-hash', 2),
				(e) => e.status === 409
			);
		});
		// Run ordinary signup against the same real Prisma guards, with all DEV tooling off.
		delete process.env.RELISH_DEV_FOUNDATION_PILOT_TARGET;
		delete process.env.RELISH_EXCHANGE_BROWSER_ENABLED;
		const registerPage = await load('routes/auth/register/+page.server');
		const google = await load('routes/auth/google/callback/+server');
		const publicPage = await load('routes/u/[slug]/+page.server');
		const leadPage = await load('routes/u/[slug]/lead/+page.server');
		const qr = await load('routes/api/qr/+server');
		const people = await load('routes/people/+page.server');
		const addPerson = await load('routes/people/new/+page.server');
		const logout = await load('routes/auth/logout/+server');

		const newBrowser = (env, appOrigin) => {
			const map = new Map();
			const cookies = {
				get: (key) => map.get(key),
				set: (key, value) => map.set(key, value),
				delete: (key) => map.delete(key)
			};
			return { cookies, locals: { env, appOrigin, sessionCookie: sessionCookieConfig(env) } };
		};
		let browser = newBrowser('prod', 'https://app.relish.live');
		const another = newBrowser('dev', origin);
		const passwordEmail = 'ordinary-password@example.invalid';
		const googleEmail = 'ordinary-google@example.invalid';
		const publicName = 'Reviewed public name';
		const editor = '/settings/profile?onboarding=1';
		const event = (client, path, fields) => {
			const url = new URL(path, client.locals.appOrigin);
			return {
				...client, url, getClientAddress: () => 'isolated-signup-fixture', setHeaders() {},
				...(fields ? { request: new Request(url, {
					method: 'POST', headers: { origin: url.origin }, body: new URLSearchParams(fields)
				}) } : {})
			};
		};
		const googleEvent = (client, email, sub) => {
			for (const [key, value] of Object.entries({
				oauth_state: 'state', oauth_nonce: 'nonce', oauth_pkce: 'verifier'
			})) client.cookies.set(key, value);
			globalThis.__p306Google = { sub, email, email_verified: true, nonce: 'nonce', name: 'Google profile name' };
			return {
				...event(client, '/auth/google/callback?code=code&state=state'),
				fetch: async () => Response.json({ id_token: 'synthetic', access_token: 'discard-fixture-token' })
			};
		};
		const sessionFor = (client) => getSessionFromCookie(client.cookies.get(client.locals.sessionCookie.name));
		const profileFor = (id) => prisma.profile.findFirstOrThrow({ where: { userId: id, isDefault: true } });
		const at = (location) => (error) => error.status === 303 && error.location === location;
		const authAs = (client, session) => {
			client.locals.user = { id: session.user.id, role: session.user.role };
			client.locals.sessionId = session.session.id;
		};
		let ordinaryId, ordinaryProfile;

		await t.test('failed password and Google provisioning roll back credentials, profile and roots', async () => {
			const before = await totals();
			await db.exec(`CREATE FUNCTION fail_ordinary_signup() RETURNS trigger LANGUAGE plpgsql AS $$
				BEGIN RAISE EXCEPTION 'synthetic failure'; END $$;
				CREATE TRIGGER fail_ordinary_signup BEFORE INSERT ON "FoundationEnrollment"
				FOR EACH ROW EXECUTE FUNCTION fail_ordinary_signup();`);
			try {
				assert.equal((await registerPage.actions.default(event(browser, '/auth/register', {
					email: passwordEmail, password
				}))).status, 503);
				await assert.rejects(google.GET(googleEvent(another, googleEmail, 'ordinary-sub')),
					(error) => error.status === 503);
				assert.equal(await sessionFor(browser), null);
				assert.equal(await sessionFor(another), null);
				assert.equal(await count('OAuthAccount'), 0);
				assert.deepEqual(await totals(), before);
			} finally {
				await db.exec('DROP TRIGGER fail_ordinary_signup ON "FoundationEnrollment"; DROP FUNCTION fail_ordinary_signup()');
			}
		});

		await t.test('ordinary PROD-shaped signup is private and concurrent duplicates create one account', async () => {
			let duplicate = newBrowser('prod', browser.locals.appOrigin);
			const before = await totals();
			const signup = (client) => registerPage.actions.default(event(client, '/auth/register', {
				email: passwordEmail, password
			}));
			const attempts = await Promise.allSettled([signup(browser), signup(duplicate)]);
			assert.equal(attempts.filter((attempt) => attempt.status === 'rejected' && at(editor)(attempt.reason)).length, 1);
			assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled' && attempt.value.status === 400).length, 1);
			if (attempts[1].status === 'rejected') [browser, duplicate] = [duplicate, browser];
			const session = await sessionFor(browser);
			ordinaryId = session.user.id;
			authAs(browser, session);
			assert.equal(session.user.role, 'member');
			assert.ok(!session.user.email_Enc.includes(passwordEmail));
			assert.equal(await sessionFor(duplicate), null);
			assert.equal(await provision.accountDomain(ordinaryId), 'ACTIVE');
			const after = await totals();
			for (const key of ['User', 'Profile', 'FoundationEnrollment', 'FoundationVault', 'FoundationSubject'])
				assert.equal(after[key], before[key] + 1, key);
			assert.equal(await provision.accountDomain('owner'), 'LEGACY');
			assert.equal((await prisma.profile.findUniqueOrThrow({ where: { id: 'legacy-card' } })).slug, 'legacy-owner');
			ordinaryProfile = await profileFor(ordinaryId);
			assert.equal(ordinaryProfile.isPublished, false);
			assert.equal(ordinaryProfile.displayName, 'New Relish user');
			assert.equal(ordinaryProfile.emailPublic, null);
			const slug = ordinaryProfile.slug;
			const guest = { ...event(duplicate, '/u/' + slug), params: { slug } };
			await assert.rejects(publicPage.load(guest), (error) => error.status === 404);
			await assert.rejects(leadPage.load(guest), (error) => error.status === 404);
			assert.equal((await qr.GET(event(duplicate, '/api/qr?slug=' + slug))).status, 404);
			assert.deepEqual((await people.load(event(browser, '/people'))).people, []);
		});

		await t.test('Google signs up normally in DEV and cannot claim another private vault by email', async () => {
			await assert.rejects(google.GET(googleEvent(another, passwordEmail, 'unlinked-sub')),
				(error) => error.status === 409);
			assert.equal(await sessionFor(another), null);
			await assert.rejects(google.GET(googleEvent(another, googleEmail, 'ordinary-sub')), at(editor));
			const session = await sessionFor(another);
			assert.notEqual(session.user.id, ordinaryId);
			const googleProfile = await profileFor(session.user.id);
			assert.equal(googleProfile.isPublished, false);
			assert.equal(googleProfile.emailPublic, null);
			assert.equal(await provision.accountDomain(session.user.id), 'ACTIVE');
			const links = (await db.query('SELECT "userId", "accessToken" FROM "OAuthAccount"')).rows;
			assert.deepEqual(links, [{ userId: session.user.id, accessToken: null }]);
			await assert.rejects(google.GET(googleEvent(another, googleEmail, 'ordinary-sub')), at('/'));
			assert.equal((await sessionFor(another)).user.id, session.user.id);
			assert.equal((await profileFor(session.user.id)).isPublished, false);
			authAs(another, session);
		});

		await t.test('ordinary profile publication, QR capture and manual People stay private through logout', async () => {
			const guest = newBrowser('prod', browser.locals.appOrigin);
			const slug = ordinaryProfile.slug;
			await assert.rejects(profilesPage.actions.save(event(browser, editor + '&/save', {
				profileId: ordinaryProfile.id, displayName: publicName, kind: 'business', publishNow: 'yes'
			})), at('/share?profile=' + slug));
			const qrImage = await qr.GET(event(guest, '/api/qr?slug=' + slug));
			assert.equal(qrImage.status, 200);
			assert.match(await qrImage.text(), /<svg/);
			const publicCard = { ...event(guest, '/u/' + slug + '?via=qr'), params: { slug } };
			assert.equal((await publicPage.load(publicCard)).profile.displayName, publicName);
			for (const action of ['startDorian', 'requestDorian'])
				assert.equal((await publicPage.actions[action](publicCard)).status, 404);
			const capturePath = '/u/' + slug + '/share-details?via=qr';
			const params = { slug };
			const capture = await capturePage.load({ ...event(guest, capturePath), params });
			assert.equal(capture.canSignIn, false);
			const result = await capturePage.actions.default({
				...event(guest, capturePath, {
					name: 'QR visitor', email: 'visitor@example.invalid', contactConsent: 'yes',
					captureToken: capture.captureToken
				}), params
			});
			assert.equal(result.shared, true);
			assert.equal(result.canClaim, undefined);
			await assert.rejects(addPerson.actions.default(event(browser, '/people/new', {
				name: 'Manual visitor'
			})), (error) => error.status === 303 && error.location.startsWith('/people/'));
			const directory = () => people.load(event(browser, '/people'));
			const visible = (await directory()).people;
			assert.deepEqual(visible.map((person) => person.name).sort(), ['Manual visitor', 'QR visitor']);
			const person = visible.find((entry) => entry.name === 'QR visitor');
			const personParams = { id: person.id };
			const detail = (client) => personPage.load({ ...event(client, '/people/' + person.id), params: personParams });
			await assert.rejects(detail(another), (error) => error.status === 404);
			const note = await notePage.load({ locals: browser.locals, params: personParams });
			await assert.rejects(notePage.actions.save({
				...event(browser, '/people/' + person.id + '/notes/new?/save', {
					text: 'Reviewed voice transcript', summary: 'Private summary', channel: 'voice', saveKey: note.saveKey
				}), params: personParams
			}), at('/people/' + person.id));
			assert.equal(await count('Contact'), 0);
			assert.equal(await count('Interaction'), 0);
			await assert.rejects(logout.POST(event(browser, '/auth/logout', {})), at('/auth/login'));
			assert.equal(await sessionFor(browser), null);
			delete browser.locals.user;
			await assert.rejects(directory(), at('/auth/login'));
			await assert.rejects(loginPage.actions.default(event(browser, '/auth/login', {
				email: passwordEmail, password
			})), at('/'));
			authAs(browser, await sessionFor(browser));
			const saved = (await detail(browser)).notes[0];
			assert.equal(saved.text, 'Reviewed voice transcript');
			assert.equal(saved.summary, 'Private summary');
		});
	} finally {
		if (prisma) await prisma.$disconnect();
		if (vite) await vite.close();
		if (socket) await socket.stop();
		await db.close();
		delete globalThis.prisma;
		delete globalThis.__p306Google;
	}
});
