// Use real guarded services and a disposable database. Every outbound SMS is intercepted locally.
import test from 'node:test';
import { applyLuMigration } from './lu-migration-fixture.mjs';
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
		await db.exec(`CREATE TABLE "User"(id text PRIMARY KEY,"email_Enc" text);
CREATE TABLE "Profile"(id text PRIMARY KEY,"userId" text NOT NULL REFERENCES "User"(id),label text NOT NULL DEFAULT 'My profile',"updatedAt" timestamp NOT NULL DEFAULT now(),kind text NOT NULL DEFAULT 'business',"displayName" text,"emailPublic" text,"phonePublic" text,"isPublished" boolean NOT NULL DEFAULT true);
CREATE TABLE "Session"(id text PRIMARY KEY,"userId" text NOT NULL REFERENCES "User"(id),"expiresAt" timestamp NOT NULL);`);
		for (const name of [
			'20261104010000_f202_foundation_schema',
			'20261107010000_s402_exchange_claims',
			'20261107020000_s402b_exchange_service',
            '20261107030000_s405c_account_channels',
            '20261108010000_s405d_guest_assurance',
            '20261109060000_google_mailbox_authority'
		])
			await db.exec(await readFile('prisma/migrations/' + name + '/migration.sql', 'utf8'));
		await applyLuMigration(db);
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
			assert.ok(['https://api.telnyx.com/v2/messages','https://api.resend.com/emails'].includes(url));
            if(url==='https://api.resend.com/emails') assert.match(options.headers['Idempotency-Key'],/^relish-verification\//);
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
		await t.test(
			'S405b owned draft profile confirmation saves both sides without any SMS',
			async () => {
				const f = await fixture();
				process.env.RELISH_EXCHANGE_BROWSER_ENABLED = 'YES';
				const selected = 'owned-' + f.b;
				await db.query(
					'INSERT INTO "Profile"(id,"userId","displayName","emailPublic","isPublished") VALUES ($1,$2,$3,$4,false)',
					[selected, f.b, 'Betty draft', 'betty@example.invalid']
				);
				const browser = randomUUID();
				const choices = await claims.ownedExchangeChoices(f.locals, f.profile, browser);
				assert.equal(choices.length, 1);
				const token = choices[0].confirmation;
				const confirm = (t = token, l = f.locals, b = browser, target = f.profile) =>
					claims.confirmOwnedProfileExchange(l, t, b, target);
				await assert.rejects(confirm(token, f.locals, 'wrong-browser'));
				await assert.rejects(confirm(token, { ...f.locals, sessionId: 'other' }));
				await assert.rejects(confirm(token, f.locals, browser, 'other-target'));
				await assert.rejects(confirm(token + 'tampered'));
                const codec=await load('lib/crypto');
                const preview=JSON.parse(codec.decrypt(token,'exchange.profile.preview.v1'));
                for(const patch of [{at:Date.now()-1800001},{profileId:f.profile}]) {
                  const forged=codec.encrypt(JSON.stringify({...preview,...patch}),'exchange.profile.preview.v1');
                  await assert.rejects(confirm(forged));
                }
                // Inject failure after both private copies to establish transaction rollback.
                const before=(await db.query('SELECT count(*)::int n FROM "FoundationSource"')).rows[0].n;
                await db.exec(`CREATE FUNCTION s405b_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic late failure'; END $$;
                CREATE TRIGGER s405b_fail BEFORE INSERT ON "FoundationExchange" FOR EACH ROW EXECUTE FUNCTION s405b_fail();`);
                try { await assert.rejects(confirm()); } finally {await db.exec('DROP TRIGGER s405b_fail ON "FoundationExchange"; DROP FUNCTION s405b_fail();');}
                assert.equal((await db.query('SELECT count(*)::int n FROM "FoundationSource"')).rows[0].n,before);
                assert.equal((await privacy.reviewFoundationPrivacy(f.a)).associations.length,0);
				const sends = sent.length;
                const simultaneous=await Promise.all([confirm(),confirm()]);
                assert.deepEqual(simultaneous[0],simultaneous[1]);
				const settled = await confirm();
				assert.deepEqual(await confirm(), settled);
				assert.equal(sent.length, sends);
				const a = await privacy.reviewFoundationPrivacy(f.a),
					b = await privacy.reviewFoundationPrivacy(f.b);
				assert.equal(a.associations.find((x) => x.accountId === f.b).channel, 'PROFILE');
				assert.equal(b.subjects.filter((x) => !x.isSelf).length, 1);
				const person = a.associations.find((x) => x.accountId === f.b).subjectId;
				// A new explicit exchange reuses account links and appends evidence, without merging the guest fixture.
				const again = (await claims.ownedExchangeChoices(f.locals, f.profile, browser))[0];
				await claims.confirmOwnedProfileExchange(f.locals, again.confirmation, browser, f.profile);
				assert.equal(
					(await privacy.reviewFoundationPrivacy(f.a)).associations.find((x) => x.accountId === f.b)
						.subjectId,
					person
				);
				await db.query('UPDATE "Profile" SET "displayName"=$1 WHERE id=$2', [
					'Changed after preview',
					selected
				]);
				await assert.rejects(
					claims.confirmOwnedProfileExchange(f.locals, again.confirmation, browser, f.profile)
				);
				assert.equal(
					(await db.query('SELECT "isPublished" FROM "Profile" WHERE id=$1', [selected])).rows[0]
						.isPublished,
					false
				);
				await privacy.suspendFoundationPrivacy(f.b);
				await assert.rejects(confirm());
				await privacy.eraseFoundationPrivacy(f.b);
				assert.equal((await privacy.reviewFoundationPrivacy(f.a)).associations.length, 0);
			}
		);
        await t.test('S405c account channels retain independent SMS proof, guards, revocation and cleanup',async()=>{
          const accounts=await load('lib/server/foundation/accountChannels');
          const f=await fixture();process.env.RELISH_EXCHANGE_BROWSER_ENABLED='YES';
          const id=await accounts.addAccountChannel(f.locals,'PHONE',f.phone);
          const email=await accounts.addAccountChannel(f.locals,'EMAIL','betty@example.invalid');
          assert.equal(await accounts.addAccountChannel(f.locals,'PHONE',f.phone),id);
          let channels=await accounts.listAccountChannels(f.locals);assert.equal(channels.length,2);assert.ok(channels.every(c=>c.status==='PENDING'));
          assert.doesNotMatch(JSON.stringify(channels),new RegExp(f.phone.replace('+','\\+')));
          await assert.rejects(prisma.foundationAccountChannel.findMany());
          await assert.rejects(prisma.user.findMany({select:{accountChannels:true}}));
          const req=await accounts.requestAccountChannelCode(f.locals,id,randomUUID(),'channel-ip');
          assert.equal(req.status,'QUEUED');
          await assert.rejects(accounts.requestAccountChannelCode(f.locals,email,randomUUID(),'channel-ip'));
          assert.equal(await accounts.dispatchAccountChannelCode(f.locals,req.challengeId),'SENT');
          const code=f.code();
          assert.equal(await accounts.verifyAccountChannelCode(f.locals,req.challengeId,'not-a-code','channel-ip'),'INVALID');
          await assert.rejects(accounts.verifyAccountChannelCode({...f.locals,sessionId:'other'},req.challengeId,code,'channel-ip'));
          const verified=await Promise.all([accounts.verifyAccountChannelCode(f.locals,req.challengeId,code,'channel-ip'),accounts.verifyAccountChannelCode(f.locals,req.challengeId,code,'channel-ip')]);
          assert.deepEqual(verified,['VERIFIED','VERIFIED']);
          assert.equal((await accounts.listAccountChannels(f.locals)).find(c=>c.id===email).status,'PENDING');
          assert.equal((await accounts.requestAccountChannelCode(f.locals,id,randomUUID(),'channel-ip')).status,'VERIFIED');
          await assert.rejects(db.query("UPDATE \"FoundationAccountChannelVerification\" SET method='EMAIL_CODE' WHERE \"channelId\"=$1",[id]));
          await assert.rejects(db.query('UPDATE "FoundationAccountChannel" SET "ownerUserId"=$1 WHERE id=$2',[f.a,id]));
          await accounts.revokeAccountChannel(f.locals,id);
          await assert.rejects(accounts.verifyAccountChannelCode(f.locals,req.challengeId,code,'channel-ip'));
          assert.equal((await accounts.listAccountChannels(f.locals)).find(c=>c.id===id).status,'REVOKED');
          // Revocation remains history; a fresh generation can prove control again after cooldown.
          await db.query('UPDATE "FoundationAccountChannelChallenge" SET "createdAt"="createdAt" WHERE id=$1',[req.challengeId]);
          const next=await accounts.requestAccountChannelCode(f.locals,id,randomUUID(),'channel-ip');assert.equal(next.status,'LIMITED');
          const originalNow=Date.now;
          let fresh;
          try {Date.now=()=>originalNow()+61000;fresh=await accounts.requestAccountChannelCode(f.locals,id,randomUUID(),'channel-ip');} finally {Date.now=originalNow;}
          assert.equal(fresh.status,'QUEUED');
          await accounts.dispatchAccountChannelCode(f.locals,fresh.challengeId);
          assert.equal(await accounts.verifyAccountChannelCode(f.locals,fresh.challengeId,f.code(),'channel-ip'),'VERIFIED');
          assert.equal((await db.query('SELECT count(*)::int n FROM "FoundationAccountChannelVerification" WHERE "channelId"=$1',[id])).rows[0].n,2);
          await accounts.revokeAccountChannel(f.locals,id);
          await accounts.eraseRevokedAccountChannel(f.locals,id);
          assert.equal((await accounts.listAccountChannels(f.locals)).length,1);
          // Vault-only suspension denies use, but does not destroy account-owned channels.
          // Offline expiry also scrubs dormant account-owned deliveries when settings are never revisited.
          const expiredChallenge=randomUUID();
          await db.query(`INSERT INTO "FoundationAccountChannelChallenge"(id,"ownerUserId","channelId",generation,"sessionHash","codeMac","createdAt","expiresAt") VALUES ($1,$2,$3,1,repeat('a',64),repeat('b',64),now()-interval '16 minutes',now()-interval '1 minute')`,[expiredChallenge,f.b,email]);
          await db.query(`INSERT INTO "FoundationAccountChannelDispatch"(id,"ownerUserId","challengeId","payloadEnc","createdAt","expiresAt") VALUES ($1,$2,$3,'synthetic-expired-ciphertext',now()-interval '16 minutes',now()-interval '1 minute')`,[randomUUID(),f.b,expiredChallenge]);
          await privacy.expireFoundationExchanges(f.b);
          const expired=(await db.query('SELECT status,"payloadEnc" FROM "FoundationAccountChannelDispatch" WHERE "challengeId"=$1',[expiredChallenge])).rows[0];
          assert.equal(expired.status,'EXPIRED');assert.equal(expired.payloadEnc,null);
          const pending=await accounts.addAccountChannel(f.locals,'PHONE','+61491579999');
          const queued=await accounts.requestAccountChannelCode(f.locals,pending,randomUUID(),'channel-ip');
          await privacy.suspendFoundationPrivacy(f.b);
          assert.equal((await db.query('SELECT "payloadEnc",status FROM "FoundationAccountChannelDispatch" WHERE "challengeId"=$1',[queued.challengeId])).rows[0].payloadEnc,null);
          await assert.rejects(accounts.listAccountChannels(f.locals));
          assert.equal((await db.query('SELECT count(*)::int n FROM "FoundationAccountChannel" WHERE "ownerUserId"=$1',[f.b])).rows[0].n,2);
        });

        await t.test('S405c competing accounts cannot both own verified assurance for one canonical number',async()=>{
          const service=await load('lib/server/foundation/accountChannels');
          const first=await fixture(), second=await fixture(first.phone);
          process.env.RELISH_EXCHANGE_BROWSER_ENABLED='YES';
          const local='0'+first.phone.slice(3);
          const a=await service.addAccountChannel(first.locals,'PHONE',local);
          const b=await service.addAccountChannel(second.locals,'PHONE',first.phone);
          await assert.rejects(service.revokeAccountChannel(second.locals,a));
          const c1=await service.requestAccountChannelCode(first.locals,a,randomUUID(),'compete-ip');
          const c2=await service.requestAccountChannelCode(second.locals,b,randomUUID(),'compete-ip');
          await service.dispatchAccountChannelCode(first.locals,c1.challengeId);const code1=first.code();
          await service.dispatchAccountChannelCode(second.locals,c2.challengeId);const code2=second.code();
          const results=await Promise.allSettled([service.verifyAccountChannelCode(first.locals,c1.challengeId,code1,'compete-ip'),service.verifyAccountChannelCode(second.locals,c2.challengeId,code2,'compete-ip')]);
          assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
          assert.equal((await db.query(`SELECT count(*)::int n FROM "FoundationAccountChannel" WHERE id IN ($1,$2) AND status='VERIFIED'`,[a,b])).rows[0].n,1);
          assert.equal((await privacy.reviewFoundationPrivacy(first.a)).associations.length,0);
          const firstWon = results[0].status === 'fulfilled';
          const conflict = results[firstWon ? 1 : 0];
          assert.equal(conflict.status, 'rejected');
          assert.equal(conflict.reason.reason, 'CHANNEL_ALREADY_VERIFIED');
          const blocked = firstWon ? b : a;
          const blockedChallenge = firstWon ? c2 : c1;
          const blockedAccount = firstWon ? second : first;
          assert.equal((await db.query('SELECT status FROM "FoundationAccountChannelChallenge" WHERE id=$1',
            [blockedChallenge.challengeId])).rows[0].status, 'PENDING');
          assert.equal((await db.query('SELECT count(*)::int n FROM "FoundationAccountChannelVerification" WHERE "channelId"=$1',
            [blocked])).rows[0].n, 0);
          await assert.rejects(db.query(`UPDATE "FoundationAccountChannel" SET status='VERIFIED' WHERE id=$1`,[blocked]));
          await service.revokeAccountChannel(firstWon ? first.locals : second.locals, firstWon ? a : b);
          assert.equal(await service.verifyAccountChannelCode(blockedAccount.locals, blockedChallenge.challengeId,
            firstWon ? code2 : code1, 'compete-ip'), 'VERIFIED');
        });

        await t.test('S405c delivery retry caps, resend invalidation and aggregate failures remain bounded',async()=>{
          const service=await load('lib/server/foundation/accountChannels');const f=await fixture();
          const id=await service.addAccountChannel(f.locals,'PHONE',f.phone);
          const issued=await service.requestAccountChannelCode(f.locals,id,randomUUID(),'bounded-channel-ip');
          providerFailure=true;
          try{for(let n=0;n<3;n++) assert.equal(await service.dispatchAccountChannelCode(f.locals,issued.challengeId),'FAILED');}finally{providerFailure=false;}
          await assert.rejects(service.dispatchAccountChannelCode(f.locals,issued.challengeId));
          assert.equal((await db.query('SELECT "payloadEnc" FROM "FoundationAccountChannelDispatch" WHERE "challengeId"=$1',[issued.challengeId])).rows[0].payloadEnc,null);
          const originalNow=Date.now;let next;
          try{Date.now=()=>originalNow()+61000;next=await service.requestAccountChannelCode(f.locals,id,randomUUID(),'bounded-channel-ip');}finally{Date.now=originalNow;}
          await assert.rejects(service.verifyAccountChannelCode(f.locals,issued.challengeId,'123456','bounded-channel-ip'));
          for(let n=0;n<5;n++) assert.equal(await service.verifyAccountChannelCode(f.locals,next.challengeId,'invalid','bounded-channel-ip'),'INVALID');
          await assert.rejects(service.verifyAccountChannelCode(f.locals,next.challengeId,'123456','bounded-channel-ip'));
          await service.revokeAccountChannel(f.locals,id);
          assert.equal((await service.listAccountChannels(f.locals))[0].status,'REVOKED');
        });

        async function v2(f,fields={}) {
          const browser=randomUUID();
          const input={...f.input,...fields,browser,captureToken:issueContactCaptureToken(f.profile,browser,'qr')};
          return capture.captureFoundationAccountExchange(f.profile,input);
        }
        await t.test('S405d exact guest submission retains phone proof and reuses it without another send',async()=>{
          const service=await load('lib/server/foundation/accountChannels');const f=await fixture();
          const token=await v2(f);
          assert.equal((await claims.accountClaimState(f.locals,token)).canComplete,false);
          await claims.startAccountClaim(f.locals, token);
          await claims.startAccountClaim(f.locals, token);
          const beforeProof = await privacy.reviewFoundationPrivacy(f.b);
          assert.equal(beforeProof.associations.length, 1);
          assert.equal(beforeProof.associations[0].channel, 'PROFILE');
          assert.equal((await privacy.reviewFoundationPrivacy(f.a)).associations.length, 0);
          await assert.rejects(claims.prepareAccountClaim(f.locals, token, 'EMAIL'));
          await assert.rejects(claims.completeAccountClaim(f.locals, token));
          const id=await claims.prepareAccountClaim(f.locals,token,'PHONE');
          const challenge=await service.requestAccountChannelCode(f.locals,id,randomUUID(),'guest-proof-ip');
          await service.dispatchAccountChannelCode(f.locals,challenge.challengeId);
          const code=f.code();assert.equal(await service.verifyAccountChannelCode(f.locals,challenge.challengeId,code,'guest-proof-ip'),'VERIFIED');
          const count=sent.length;
          const results=await Promise.all([claims.completeAccountClaim(f.locals,token),claims.completeAccountClaim(f.locals,token)]);
          assert.deepEqual(results[0],results[1]);assert.equal(sent.length,count);
          assert.equal(results[0].personId, beforeProof.associations[0].subjectId);
          const status=await claims.accountClaimState(f.locals,token);
          assert.equal(status.channels.find(c=>c.type==='PHONE').verified,true);
          assert.equal((await privacy.reviewFoundationPrivacy(f.a)).associations[0].channel,'ACCOUNT_CHANNEL');
          const other=await fixture();const another=await v2(other,{phone:f.phone});
          await assert.rejects(claims.completeAccountClaim(other.locals,another));
          await claims.completeAccountClaim(f.locals,another);
          assert.equal(sent.length,count);
          await assert.rejects(claims.completeAccountClaim(other.locals,token));
          await service.revokeAccountChannel(f.locals,id);
          await assert.rejects(claims.completeAccountClaim(f.locals,token));
        });
        async function setLoginEmail(f, email) {
          const { encryptedUserEmailFields } = await load('lib/server/userEmail');
          await db.query('UPDATE "User" SET "email_Enc"=$2 WHERE id=$1',
            [f.b, encryptedUserEmailFields(email).email_Enc]);
          process.env.RESEND_API_KEY='synthetic-intercepted';
          process.env.RELISH_VERIFICATION_EMAIL_FROM='Relish <verify@example.invalid>';
          process.env.RELISH_EXCHANGE_TEST_EMAILS=email;
        }

        await t.test('login email check settles a matching share without verifying its phone', async () => {
          const service = await load('lib/server/foundation/accountChannels');
          const f = await fixture();
          const email = 'matching-login@example.invalid';
          await setLoginEmail(f, email);
          const token = await v2(f, { email });
          await claims.startAccountClaim(f.locals, token);
          assert.equal((await claims.accountClaimState(f.locals, token)).channel.step, 'LOGIN_EMAIL');
          await assert.rejects(claims.prepareAccountClaim(f.locals, token, 'PHONE'));
          await assert.rejects(claims.completeAccountClaim(f.locals, token));
          const channelId = await claims.prepareAccountClaim(f.locals, token, 'LOGIN_EMAIL');
          const issued = await service.requestAccountChannelCode(f.locals, channelId, randomUUID(), 'matching-login');
          await service.dispatchAccountChannelCode(f.locals, issued.challengeId);
          assert.deepEqual(sent.at(-1).to, [email]);
          assert.equal(await service.verifyAccountChannelCode(f.locals, issued.challengeId, f.code(), 'matching-login'), 'VERIFIED');
          await claims.completeAccountClaim(f.locals, token);
          const state = await claims.accountClaimState(f.locals, token);
          assert.deepEqual(state.channels, [{ type: 'PHONE', verified: false }, { type: 'EMAIL', verified: true }]);
        });

        await t.test('different login email stays private and phone-only share still needs its own proof', async () => {
          const service = await load('lib/server/foundation/accountChannels');
          const f = await fixture();
          const email = 'workspace@example.invalid';
          await setLoginEmail(f, email);
          const token = await v2(f);
          await claims.startAccountClaim(f.locals, token);
          await service.recordGoogleEmailProof(f.locals, email);
          const state = await claims.accountClaimState(f.locals, token);
          assert.equal(state.channel.step, 'PHONE');
          assert.equal(state.canComplete, false);
          await assert.rejects(claims.completeAccountClaim(f.locals, token));
          assert.equal((await privacy.reviewFoundationPrivacy(f.a)).associations.length, 0);
          assert.equal((await privacy.reviewFoundationPrivacy(f.b)).associations.length, 1);
          const matching = await v2(f, { email });
          const count = sent.length;
          await claims.completeAccountClaim(f.locals, matching);
          assert.equal(sent.length, count);
        });

        await t.test('historic outside Google email proof needs a new mailbox check', async () => {
          const service = await load('lib/server/foundation/accountChannels');
          const f = await fixture();
          const email = 'historic-google@example.invalid';
          await setLoginEmail(f, email);
          const token = await v2(f, { email });
          const id = await service.addAccountChannel(f.locals, 'EMAIL', email);
          await db.exec('BEGIN');
          await db.query('UPDATE "FoundationAccountChannel" SET generation=1, status=\'VERIFIED\' WHERE id=$1', [id]);
          await db.query(`INSERT INTO "FoundationAccountChannelVerification"
            (id,"ownerUserId","channelId",generation,method,"proofRef")
            VALUES ($1,$2,$3,1,'GOOGLE_OIDC',$4)`, [randomUUID(), f.b, id, randomUUID()]);
          await db.exec('COMMIT');
          assert.equal((await claims.accountClaimState(f.locals, token)).channel.step, 'LOGIN_EMAIL');
          assert.equal((await service.listAccountChannels(f.locals))[0].status, 'PENDING');
          await assert.rejects(claims.completeAccountClaim(f.locals, token));
          const issued = await service.requestAccountChannelCode(f.locals, id, randomUUID(), 'historic-login');
          await service.dispatchAccountChannelCode(f.locals, issued.challengeId);
          assert.equal(await service.verifyAccountChannelCode(f.locals, issued.challengeId, f.code(), 'historic-login'), 'VERIFIED');
          await claims.completeAccountClaim(f.locals, token);
          assert.equal((await db.query('SELECT "revokeReason" FROM "FoundationAccountChannelVerification" WHERE "channelId"=$1 AND generation=1',[id])).rows[0].revokeReason, 'MAILBOX_RECHECK');
        });

        await t.test('S405d email-only claim delivers bounded codes and records independent email proof',async()=>{
          const service=await load('lib/server/foundation/accountChannels');const f=await fixture();
          const email='email-guest@example.invalid';process.env.RESEND_API_KEY='synthetic-intercepted';process.env.RELISH_VERIFICATION_EMAIL_FROM='Relish <verify@example.invalid>';process.env.RELISH_EXCHANGE_TEST_EMAILS=email;
          const token=await v2(f,{phone:'',email});
          const id=await claims.prepareAccountClaim(f.locals,token,'EMAIL');
          await assert.rejects(claims.prepareAccountClaim(f.locals,token,'PHONE'));
          const pending=await service.requestAccountChannelCode(f.locals,id,randomUUID(),'email-proof-ip');
          await service.dispatchAccountChannelCode(f.locals,pending.challengeId);
          assert.deepEqual(sent.at(-1).to,[email]);const code=f.code();
          await service.verifyAccountChannelCode(f.locals,pending.challengeId,code,'email-proof-ip');
          await claims.completeAccountClaim(f.locals,token);
          const state=await service.listAccountChannels(f.locals);assert.equal(state[0].method,'EMAIL_CODE');
          assert.equal(state[0].status,'VERIFIED');assert.equal(state.length,1);
          await assert.rejects(db.query('UPDATE "FoundationExchange" SET "claimVersion"=1 WHERE "continuationHash"=$1',[crypto.claimMac(token,'lookup')]));
        });
        await t.test('S405d proof survives withdrawn exchange and Google proof never revives a revoked email',async()=>{
          const service=await load('lib/server/foundation/accountChannels');const f=await fixture();
          const token=await v2(f);const id=await claims.prepareAccountClaim(f.locals,token,'PHONE');
          const issued=await service.requestAccountChannelCode(f.locals,id,randomUUID(),'withdraw-proof-ip');
          await service.dispatchAccountChannelCode(f.locals,issued.challengeId);const code=f.code();
          await db.query('UPDATE "Profile" SET "isPublished"=false WHERE id=$1',[f.profile]);
          await service.verifyAccountChannelCode(f.locals,issued.challengeId,code,'withdraw-proof-ip');
          await assert.rejects(claims.completeAccountClaim(f.locals,token));
          assert.equal((await service.listAccountChannels(f.locals))[0].status,'VERIFIED');
          const email='google-proof@example.invalid';
          await service.recordGoogleEmailProof(f.locals,email);
          const google=(await service.listAccountChannels(f.locals)).find(c=>c.type==='EMAIL');assert.equal(google.method,'GOOGLE_MAILBOX');
          await service.revokeAccountChannel(f.locals,google.id);
          assert.equal(await service.recordGoogleEmailProof(f.locals,email),'REVOKED');
          assert.equal((await service.listAccountChannels(f.locals)).find(c=>c.id===google.id).status,'REVOKED');
        });

		await t.test('production v2 settles with real service boundaries and both provider destinations outside DEV allowlists', async () => {
			const service = await load('lib/server/foundation/accountChannels');
			const { exchangeBrowserEnabled } = await load('lib/server/foundation/devPilotGate');
			const prod = { env: 'prod', appOrigin: 'https://app.relish.live' };
			process.env.RELISH_PROD_EXCHANGE_ENABLED = 'YES';
			process.env.APP_ORIGIN_PROD = prod.appOrigin;
			process.env.RELISH_PROD_EXCHANGE_TARGET = 'wrong.example/postgres';
			assert.equal(exchangeBrowserEnabled(prod, prod.appOrigin), false);
			process.env.RELISH_PROD_EXCHANGE_TARGET = new URL(process.env.DATABASE_URL).host + new URL(process.env.DATABASE_URL).pathname;
			assert.equal(exchangeBrowserEnabled(prod, 'https://wrong.example'), false);
			assert.equal(exchangeBrowserEnabled(prod, prod.appOrigin), true);
			for (const type of ['EMAIL', 'PHONE']) {
				const f = await fixture();
				const email = 'production-guest@example.invalid';
				const token = await v2(f, type === 'EMAIL' ? { phone: '', email } : {});
				const locals = { ...f.locals, ...prod };
				process.env.RELISH_EXCHANGE_TEST_PHONES = '';
				process.env.RELISH_EXCHANGE_TEST_EMAILS = '';
				const id = await claims.prepareAccountClaim(locals, token, type);
				const issued = await service.requestAccountChannelCode(locals, id, randomUUID(), 'production-fixture');
				await assert.rejects(service.dispatchAccountChannelCode(f.locals, issued.challengeId));
				assert.equal(await service.dispatchAccountChannelCode(locals, issued.challengeId), 'SENT');
				assert.deepEqual(sent.at(-1).to, type === 'EMAIL' ? [email] : f.phone);
				assert.equal(await service.verifyAccountChannelCode(locals, issued.challengeId, f.code(), 'production-fixture'), 'VERIFIED');
				assert.equal((await claims.completeAccountClaim(locals, token)).status, 'SETTLED');
			}
		});

	} finally {
		globalThis.fetch = originalFetch;
		if (prisma) await prisma.$disconnect();
		if (vite) await vite.close();
		if (socket) await socket.stop();
		if (db) await db.close();
		delete globalThis.prisma;
	}
});
