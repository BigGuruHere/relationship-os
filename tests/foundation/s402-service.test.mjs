// Use real guarded services and a disposable database. Every outbound SMS is intercepted locally.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createServer } from 'vite';

test('S-402b SMS claim service', { timeout: 120000 }, async (t) => {
	let db, socket, vite, prisma;
	const originalFetch = globalThis.fetch;
	const endpoint = process.env.S402_TEST_DATABASE_URL;
	try {
		if (endpoint) {
			const url = new URL(endpoint);
			assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
			assert.match(url.pathname, /^\/relish_s402_[a-z0-9_]+$/);
			assert.equal(url.search, '');
			const { Client } = await import('pg');
			const client = new Client({ connectionString: endpoint });
			await client.connect();
			db = {
				exec: (sql) => client.query(sql),
				query: (...args) => client.query(...args),
				close: () => client.end()
			};
			assert.equal(
				(await db.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0]
					.n,
				0
			);
		} else db = await PGlite.create();
		await db.exec(`CREATE TABLE "User"(id text PRIMARY KEY);
CREATE TABLE "Profile"(id text PRIMARY KEY,"userId" text NOT NULL REFERENCES "User"(id),kind text NOT NULL DEFAULT 'business',"displayName" text,"emailPublic" text,"phonePublic" text,"isPublished" boolean NOT NULL DEFAULT true);
CREATE TABLE "Session"(id text PRIMARY KEY,"userId" text NOT NULL REFERENCES "User"(id),"expiresAt" timestamp NOT NULL);`);
		for (const name of [
			'20261104010000_f202_foundation_schema',
			'20261107010000_s402_exchange_claims',
			'20261107020000_s402b_exchange_service'
		])
			await db.exec(await readFile('prisma/migrations/' + name + '/migration.sql', 'utf8'));
		if (!endpoint) {
			socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 1 });
			await socket.start();
		}
		process.env.DATABASE_URL = endpoint
			? endpoint + '?connection_limit=4'
			: 'postgresql://postgres:postgres@' + socket.getServerConn() + '/postgres?connection_limit=1';
		process.env.SECRET_MASTER_KEY = 'a'.repeat(64);
		process.env.SESSION_COOKIE_SECRET = 'synthetic-s402-session-secret-only';
		process.env.DB_KEEPALIVE_ENABLED = 'NO';
		process.env.RELISH_EXCHANGE_REALM = 'dev-s402-test';
		process.env.APP_ORIGIN_DEV = 'https://dev.relish.live';
		process.env.RELISH_DEV_FOUNDATION_PILOT_TARGET =
			new URL(process.env.DATABASE_URL).host + new URL(process.env.DATABASE_URL).pathname;
		process.env.TELNYX_API_KEY = 'synthetic-intercepted-only';
		process.env.RELISH_DORIAN_SMS_NUMBER = '+61491570000';
		vite = await createServer({
			configFile: false,
			server: { middlewareMode: true, hmr: false },
			resolve: { alias: { $lib: resolve('src/lib') } }
		});
		const load = (p) => vite.ssrLoadModule('/src/' + p + '.ts');
		({ prisma } = await load('lib/db'));
		const provision = await load('lib/server/foundation/provisioning');
		const capture = await load('lib/server/foundation/capture');
		const claims = await load('lib/server/foundation/exchangeClaims');
		const privacy = await load('lib/server/foundation/privacyOperations');
		const { issueContactCaptureToken } = await load('lib/server/core/contactCaptureToken');
		const crypto = await load('lib/server/foundation/exchangeCrypto');
		const sent = [];
		let providerFailure = false;
		globalThis.fetch = async (url, options) => {
			assert.equal(url, 'https://api.telnyx.com/v2/messages');
			const body = JSON.parse(options.body);
			sent.push(body);
			return new Response('', { status: providerFailure ? 503 : 200 });
		};
		let sequence = 0;
		async function fixture(sharedPhone) {
			const n = ++sequence;
			const a = 'a' + n,
				b = 'b' + n,
				session = 'session' + n,
				profile = 'profile' + n;
			await db.query('INSERT INTO "User"(id) VALUES ($1),($2)', [a, b]);
			for (const id of [a, b]) await provision.prepareFoundationAccount(id);
			await db.query(
				'UPDATE "FoundationEnrollment" SET state=\'ACTIVE\',epoch=epoch+1 WHERE "userId" IN ($1,$2)',
				[a, b]
			);
			await db.query(
				'INSERT INTO "Profile"(id,"userId","displayName","emailPublic") VALUES ($1,$2,$3,$4)',
				[profile, a, 'Mark ' + n, 'mark@example.invalid']
			);
			await db.query('INSERT INTO "Session"(id,"userId","expiresAt") VALUES ($1,$2,$3)', [
				session,
				b,
				new Date(Date.now() + 86400000)
			]);
			const browser = randomUUID();
			const phone = sharedPhone ?? '+6149157' + String(n).padStart(4, '0');
			process.env.RELISH_EXCHANGE_TEST_PHONES =
				(process.env.RELISH_EXCHANGE_TEST_PHONES || '') + ',' + phone;
			const input = {
				browser,
				captureToken: issueContactCaptureToken(profile, browser, 'qr'),
				name: 'Betty ' + n,
				phone
			};
			const continuation = await capture.captureFoundationExchange(profile, input);
			const locals = {
				user: { id: b },
				sessionId: session,
				env: 'dev',
				appOrigin: 'https://dev.relish.live'
			};
			const requestId = randomUUID();
			const request = () =>
				claims.requestExchangeCode(locals, continuation, requestId, '127.0.0.1');
			const dispatch = () => claims.dispatchExchangeCode(locals, continuation, requestId);
			const verify = (code) =>
				claims.verifyExchangeCode(locals, continuation, requestId, code, '127.0.0.1');
			const code = () => sent.at(-1).text.match(/code: (\d{6})/)[1];
			return {
				a,
				b,
				session,
				profile,
				phone,
				input,
				continuation,
				locals,
				requestId,
				request,
				dispatch,
				verify,
				code
			};
		}
		await t.test('successful capture, retry, SMS and atomic reciprocal settlement', async () => {
			const f = await fixture();
			assert.equal(await capture.captureFoundationExchange(f.profile, f.input), f.continuation);
			const results = await Promise.all([f.request(), f.request()]);
			assert.deepEqual(results[0], results[1]);
			assert.equal(results[0].status, 'QUEUED');
			assert.equal((await f.dispatch()).status, 'SENT');
			const count = sent.length;
			assert.equal((await f.dispatch()).status, 'SENT');
			assert.equal(sent.length, count);
			const result = await f.verify(f.code());
			assert.equal(result.status, 'SETTLED');
			assert.deepEqual(await f.verify(f.code()), result);
			const mark = await privacy.reviewFoundationPrivacy(f.a);
			const betty = await privacy.reviewFoundationPrivacy(f.b);
			assert.equal(mark.subjects.filter((s) => !s.isSelf).length, 1);
			assert.equal(betty.subjects.filter((s) => !s.isSelf).length, 1);
			assert.equal(betty.subjects.find((s) => !s.isSelf).name, 'Mark 1');
			assert.equal(mark.associations[0].accountId, f.b);
			assert.equal(betty.associations[0].accountId, f.a);
			assert.equal(mark.deliveries[0].status, 'SENT');
			assert.doesNotMatch(JSON.stringify(result), /Mark|Betty|6149|example/);
			// Both incoming references and private proof material are removed by erasure.
			await privacy.suspendFoundationPrivacy(f.b);
			await privacy.eraseFoundationPrivacy(f.b);
			const after = await privacy.reviewFoundationPrivacy(f.a);
			assert.equal(after.exchanges.length, 0);
			assert.equal(after.challenges.length, 0);
			assert.equal(after.associations.length, 0);
			assert.equal(after.subjects.filter((s) => !s.isSelf).length, 1);
		});
		await t.test(
			'wrong codes commit bounded counters and account or session switching fails',
			async () => {
				const f = await fixture();
				await f.request();
				await assert.rejects(
					claims.dispatchExchangeCode(
						{ ...f.locals, sessionId: 'missing' },
						f.continuation,
						f.requestId
					),
					/unavailable/
				);
				await db.query('INSERT INTO "Session"(id,"userId","expiresAt") VALUES ($1,$2,$3)', [
					'other-session',
					f.b,
					new Date(Date.now() + 86400000)
				]);
				await assert.rejects(
					claims.verifyExchangeCode(
						{ ...f.locals, sessionId: 'other-session' },
						f.continuation,
						f.requestId,
						'123456',
						'127.0.0.1'
					),
					/unavailable/
				);
				for (let i = 0; i < 5; i++) assert.equal((await f.verify('invalid')).status, 'INVALID');
				await assert.rejects(f.verify('123456'), /unavailable/);
				const row = (
					await db.query(
						'SELECT "failedAttempts" FROM "FoundationExchange" WHERE "ownerUserId"=$1',
						[f.a]
					)
				).rows[0];
				assert.equal(row.failedAttempts, 5);
			}
		);
		await t.test(
			'unpublished profile, realm mismatch and suspended beneficiary deny use',
			async () => {
				const f = await fixture();
				await f.request();
				process.env.RELISH_EXCHANGE_REALM = 'other-realm';
				await assert.rejects(f.dispatch(), /unavailable/);
				process.env.RELISH_EXCHANGE_REALM = 'dev-s402-test';
				await db.query('UPDATE "Profile" SET "isPublished"=false WHERE id=$1', [f.profile]);
				await assert.rejects(f.dispatch(), /unavailable/);
				await db.query('UPDATE "Profile" SET "isPublished"=true WHERE id=$1', [f.profile]);
				await privacy.suspendFoundationPrivacy(f.b);
				await assert.rejects(f.dispatch(), /unavailable/);
				assert.equal(
					(
						await db.query(
							'SELECT "payloadEnc" FROM "FoundationExchangeDispatch" WHERE "challengeId"=$1',
							[f.requestId]
						)
					).rows[0].payloadEnc,
					null
				);
			}
		);
		await t.test('provider failure is redacted, retried and bounded', async () => {
			const f = await fixture();
			await f.request();
			providerFailure = true;
			for (let i = 0; i < 3; i++) assert.equal((await f.dispatch()).status, 'FAILED');
			assert.equal((await f.dispatch()).status, 'EXPIRED');
			providerFailure = false;
			const row = (
				await db.query(
					'SELECT "payloadEnc","lastErrorCode" FROM "FoundationExchangeDispatch" WHERE "challengeId"=$1',
					[f.requestId]
				)
			).rows[0];
			assert.equal(row.payloadEnc, null);
			assert.equal(row.lastErrorCode, 'DELIVERY_FAILED');
		});
		await t.test(
			'a late settlement failure rolls back both vaults and code consumption',
			async () => {
				const f = await fixture();
				await f.request();
				await f.dispatch();
				const code = f.code();
				const beforeA = await privacy.reviewFoundationPrivacy(f.a);
				const beforeB = await privacy.reviewFoundationPrivacy(f.b);
				await db.exec(`CREATE FUNCTION s402_fail_settlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='SETTLED' THEN RAISE EXCEPTION 'synthetic settlement failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER s402_fail_settlement BEFORE UPDATE ON "FoundationExchange" FOR EACH ROW EXECUTE FUNCTION s402_fail_settlement();`);
				try {
					await assert.rejects(f.verify(code));
				} finally {
					await db.exec(
						'DROP TRIGGER s402_fail_settlement ON "FoundationExchange"; DROP FUNCTION s402_fail_settlement()'
					);
				}
				assert.deepEqual(await privacy.reviewFoundationPrivacy(f.a), beforeA);
				assert.deepEqual(await privacy.reviewFoundationPrivacy(f.b), beforeB);
				assert.equal((await f.verify(code)).status, 'SETTLED');
			}
		);
		await t.test(
			'DEV destination allowlist, canonical phone validation and forged claim token fail closed',
			async () => {
				for (const phone of [
					'+61garbage491570001',
					'+1 555 1234567',
					'04123',
					'+610491570001',
					'0491570001x'
				])
					assert.throws(() => crypto.verificationPhone(phone), /unavailable/);
				assert.equal(crypto.verificationPhone('0491 570 001'), '+61491570001');
				const f = await fixture();
				await f.request();
				const saved = process.env.RELISH_EXCHANGE_TEST_PHONES;
				process.env.RELISH_EXCHANGE_TEST_PHONES = '';
				await assert.rejects(f.dispatch(), /unavailable/);
				process.env.RELISH_EXCHANGE_TEST_PHONES = saved;
				await assert.rejects(
					claims.requestExchangeCode(f.locals, '0'.repeat(64), randomUUID(), '127.0.0.1'),
					/unavailable/
				);
			}
		);
		await t.test('concurrent settlement returns the same private result', async () => {
			const f = await fixture();
			await f.request();
			await f.dispatch();
			const code = f.code();
			const results = await Promise.all([f.verify(code), f.verify(code)]);
			assert.deepEqual(results[0], results[1]);
			assert.equal((await privacy.reviewFoundationPrivacy(f.b)).sources.length, 1);
		});
		await t.test(
			'suspension racing settlement always leaves links revoked and proof unusable',
			async () => {
				const f = await fixture();
				await f.request();
				await f.dispatch();
				const code = f.code();
				const outcomes = await Promise.allSettled([
					f.verify(code),
					privacy.suspendFoundationPrivacy(f.b)
				]);
				assert.equal(outcomes[1].status, 'fulfilled');
				const review = await privacy.reviewFoundationPrivacy(f.a);
				assert.equal(review.exchanges[0].status, 'REVOKED');
				assert.ok(review.associations.every((row) => row.state === 'REVOKED'));
				await assert.rejects(f.verify(code), /unavailable/);
			}
		);
		await t.test('resend invalidates the old code without resetting attempts', async () => {
			const f = await fixture();
			await f.request();
			await f.dispatch();
			const oldCode = f.code();
			await f.verify('not-a-code');
			const realNow = Date.now;
			const next = randomUUID();
			try {
				Date.now = () => realNow() + 61000;
				assert.equal(
					(await claims.requestExchangeCode(f.locals, f.continuation, next, '127.0.0.1')).status,
					'QUEUED'
				);
			} finally {
				Date.now = realNow;
			}
			await assert.rejects(f.verify(oldCode), /unavailable/);
			await claims.dispatchExchangeCode(f.locals, f.continuation, next);
			const result = await claims.verifyExchangeCode(
				f.locals,
				f.continuation,
				next,
				f.code(),
				'127.0.0.1'
			);
			assert.equal(result.status, 'SETTLED');
			assert.equal(
				(
					await db.query(
						'SELECT "failedAttempts" n FROM "FoundationExchange" WHERE "ownerUserId"=$1',
						[f.a]
					)
				).rows[0].n,
				1
			);
		});
		await t.test(
			'expired dormant deliveries are scrubbed by owner-scoped maintenance',
			async () => {
				const f = await fixture();
				await f.request();
				t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 16 * 60 * 1000 });
				try {
					await assert.rejects(f.verify('000000'), /unavailable/);
					const result = await privacy.expireFoundationExchanges(f.a);
					assert.equal(result.deliveries, 1);
					assert.equal(result.challenges, 1);
					const rows = await db.query(
						'SELECT "payloadEnc" FROM "FoundationExchangeDispatch" WHERE "ownerUserId"=$1',
						[f.a]
					);
					assert.equal(rows.rows[0].payloadEnc, null);
				} finally {
					t.mock.timers.reset();
				}
			}
		);
		await t.test('archived origin and self-exchange cannot create account links', async () => {
			const f = await fixture();
			await f.request();
			await f.dispatch();
			await db.query(
				'UPDATE "FoundationSubject" SET state=\'ARCHIVED\' WHERE "ownerUserId"=$1 AND "selfUserId" IS NULL',
				[f.a]
			);
			await assert.rejects(f.verify(f.code()), /unavailable/);
			await db.query('INSERT INTO "Session"(id,"userId","expiresAt") VALUES ($1,$2,$3)', [
				'self-session',
				f.a,
				new Date(Date.now() + 3600000)
			]);
			await assert.rejects(
				claims.requestExchangeCode(
					{ ...f.locals, user: { id: f.a }, sessionId: 'self-session' },
					f.continuation,
					randomUUID(),
					'127.0.0.1'
				),
				/unavailable/
			);
			assert.equal((await privacy.reviewFoundationPrivacy(f.a)).associations.length, 0);
		});
		await t.test(
			'persistent account budgets commit a refusal without issuing a challenge',
			async () => {
				const f = await fixture();
				const hour = Math.floor(Date.now() / 3600000);
				const id = crypto.claimMac(hour + ':send:account:' + f.b, 'budget');
				await db.query(
					'INSERT INTO "FoundationClaimBudget"(id,count,"expiresAt") VALUES ($1,10,$2)',
					[id, new Date((hour + 1) * 3600000)]
				);
				assert.equal((await f.request()).status, 'LIMITED');
				assert.equal((await privacy.reviewFoundationPrivacy(f.a)).challenges.length, 0);
			}
		);
		await t.test('a shared verified number cannot associate a different account', async () => {
			const f = await fixture();
			await f.request();
			await f.dispatch();
			await f.verify(f.code());
			const other = await fixture(f.phone);
			await other.request();
			await other.dispatch();
			await assert.rejects(other.verify(other.code()), /unavailable/);
			assert.equal((await privacy.reviewFoundationPrivacy(other.a)).associations.length, 0);
			// SQL forbids rewriting assurance and a settled recipient, even within valid custody.
			await assert.rejects(
				db.query(
					'UPDATE "FoundationAccountAssociation" SET "exchangeRef"=\'rewrite\' WHERE "ownerUserId"=$1',
					[f.a]
				),
				/Invalid association mutation/
			);
			await assert.rejects(
				db.query(
					'UPDATE "FoundationExchange" SET "settledSubjectId"=NULL,"settledVaultId"=NULL,status=\'REVOKED\' WHERE "ownerUserId"=$1',
					[f.a]
				),
				/Invalid exchange mutation/
			);
		});
		await t.test(
			'local AU contact and formatted allowlist share one canonical destination',
			async () => {
				const f = await fixture('0491579999');
				process.env.RELISH_EXCHANGE_TEST_PHONES = '  +61 491 579 999  ';
				await f.request();
				assert.equal((await f.dispatch()).status, 'SENT');
				assert.equal(sent.at(-1).to, '+61491579999');
			}
		);
		await t.test(
			'a blocked destination emits a safe typed reason and never calls the provider',
			async () => {
				const f = await fixture();
				await f.request();
				process.env.RELISH_EXCHANGE_TEST_PHONES = '';
				const before = sent.length;
				await assert.rejects(f.dispatch(), (e) => e.reason === 'DESTINATION_NOT_ALLOWED');
				assert.equal(sent.length, before);
			}
		);
	} finally {
		globalThis.fetch = originalFetch;
		if (prisma) await prisma.$disconnect();
		if (vite) await vite.close();
		if (socket) await socket.stop();
		if (db) await db.close();
		delete globalThis.prisma;
	}
});
