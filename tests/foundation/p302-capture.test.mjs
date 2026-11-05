// Exercise the shipped adapters with synthetic accounts. All SQL lives in an in-memory database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createServer } from 'vite';
import { legacySchemaFixture } from './legacy-schema-fixture.mjs';

test('P-302 public exchange routes and private intake', { timeout: 120000 }, async (t) => {
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
		await db.exec(`INSERT INTO "User" (id,"updatedAt") VALUES ('pilot',now()),('second',now()),('legacy',now());
      INSERT INTO "Profile"(id,"userId",slug,"updatedAt") VALUES ('pilot-card','pilot','pilot',now()),('legacy-card','legacy','legacy',now()),('second-card','second','second',now());`);
		socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 1 });
		await socket.start();
		process.env.DATABASE_URL =
			'postgresql://postgres:postgres@' + socket.getServerConn() + '/postgres?connection_limit=1';
		process.env.SECRET_MASTER_KEY = 'a'.repeat(64);
		process.env.SESSION_COOKIE_SECRET = 'synthetic-only-session-key-for-F206';
		process.env.SESSION_DAYS = '7';
		process.env.DB_KEEPALIVE_ENABLED = 'NO';
		vite = await createServer({
			configFile: false,
			server: { middlewareMode: true },
			resolve: { alias: { $lib: resolve('src/lib') } },
			plugins: [
				{
					name: 'synthetic-svelte-environment',
					resolveId(id) {
						if (id === '$app/environment') return '\0f206-environment';
					},
					load(id) {
						if (id === '\0f206-environment') return 'export const dev=true;';
					}
				}
			]
		});
		const load = (path) => vite.ssrLoadModule('/src/' + path + '.ts');
		({ prisma } = await load('lib/db'));
		const auth = await load('lib/auth');
		const provision = await load('lib/server/foundation/provisioning');
		const policy = await load('lib/server/foundation/policy');
		const people = await load('lib/server/foundation/subjects');
		const evidence = await load('lib/server/foundation/evidence');

		const route = await load('routes/u/[slug]/share-details/+page.server');
		const capture = await load('lib/server/core/contactCapture');
		const tokens = await load('lib/server/core/contactCaptureToken');
		const crypto = await load('lib/crypto');
		const custody = await load('lib/server/core/contextSpace');
		const detail = await load('routes/people/[id]/+page.server');
		const root = await provision.prepareFoundationAccount('pilot');
		await provision.prepareFoundationAccount('second');
		await db.exec(`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1;
      INSERT INTO "Profile"(id,"userId",slug,"updatedAt") VALUES ('limit-card','pilot','limit',now()),('other-card','pilot','other',now())`);
		const locals = { user: { id: 'pilot' } };
		function jar() {
			const values = new Map();
			return {
				get: (k) => values.get(k),
				set: (k, v) => values.set(k, v),
				delete: (k) => values.delete(k),
				values
			};
		}
		async function form(slug = 'pilot', cookies = jar()) {
			const event = {
				params: { slug },
				url: new URL('https://fixture.invalid/u/' + slug + '/share-details'),
				cookies,
				locals: {},
				setHeaders() {}
			};
			const data = await route.load(event);
			return { event, data, cookies };
		}
		const values = {
			name: 'QR visitor',
			email: 'visitor@example.test',
			phone: '0412 345 678',
			contactConsent: 'yes'
		};
		async function submit(f, change = {}, who = {}) {
			return route.actions.default({
				...f.event,
				locals: who,
				request: new Request(f.event.url, {
					method: 'POST',
					headers: { origin: f.event.url.origin },
					body: new URLSearchParams({ ...values, captureToken: f.data.captureToken, ...change })
				})
			});
		}
		const count = async (table) =>
			(await db.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;
		let first, personId, sourceId, segmentId;
		await t.test(
			'anonymous Send atomically saves an encrypted private person and stored-only exchange',
			async () => {
				first = await form();
				assert.equal(first.data.createStep, false);
				const result = await submit(first, {
					userId: 'second',
					vaultId: 'forged',
					context: 'business',
					allowPrivateAnalysis: 'true'
				});
				assert.equal(result.shared, true);
				assert.deepEqual(Object.keys(result).sort(), ['shared', 'values']);
				assert.equal(await count('Contact'), 0);
				assert.equal(await count('Interaction'), 0);
				const rows = (
					await db.query(`SELECT * FROM "FoundationSubject" WHERE "selfUserId" IS NULL`)
				).rows;
				assert.equal(rows.length, 1);
				personId = rows[0].id;
				assert.equal(rows[0].ownerUserId, 'pilot');
				assert.equal(rows[0].selfUserId, null);
				assert.ok(!rows[0].detailsEnc.includes(values.email));
				const opened = await detail.load({ locals, params: { id: personId } });
				assert.equal(opened.contact.email, values.email);
				assert.ok(opened.origin.submittedAt);
				await assert.rejects(
					detail.load({ locals: { user: { id: 'second' } }, params: { id: personId } }),
					(e) => e.status === 404
				);
				const version = (await db.query('SELECT * FROM "FoundationSourceVersion"')).rows[0];
				sourceId = version.sourceId;
				assert.equal(version.recordedByKind, 'VISITOR');
				assert.equal(version.processingAdmission, 'STORED_ONLY');
				const provenance = JSON.parse(
					crypto.decrypt(
						version.provenanceEnc,
						`foundation:v1:FoundationSourceVersion:provenanceEnc:pilot:${root.vaultId}:${version.id}`
					)
				);
				assert.equal(provenance.profileId, 'pilot-card');
				assert.equal(provenance.consent.purpose, 'PRIVATE_CONTACT_AND_FOLLOWUP');
				assert.equal(provenance.identityStatus, 'UNVERIFIED_SELF_SUBMISSION');
				assert.equal(provenance.entryHint, 'profile_link');
				segmentId = (await db.query('SELECT id FROM "FoundationEvidenceSegment"')).rows[0].id;
				assert.equal(await count('FoundationEvidenceSubject'), 1);
				assert.equal(await count('Person'), 0);
				assert.equal((await form('pilot', first.cookies)).data.createStep, true);
			}
		);
		await t.test(
			'identical retries succeed once and changed payload cannot overwrite the original',
			async () => {
				assert.equal((await submit(first)).shared, true);
				assert.equal((await submit(first, { name: 'Changed' })).status, 409);
				assert.equal(await count('FoundationSource'), 1);
				assert.equal(
					(await detail.load({ locals, params: { id: personId } })).contact.name,
					values.name
				);
			}
		);
		await t.test(
			'signed-in visitors receive the same intake boundary and uncertain duplicates stay distinct',
			async () => {
				const next = await form();
				const result = await custody.runWithWorkspaceCustody(
					{ userId: 'second', contextSpaceId: 'second' },
					() => submit(next, {}, { user: { id: 'second' } })
				);
				assert.equal(result.shared, true);
				assert.equal(await count('FoundationSource'), 2);
				assert.equal(
					(
						await people.searchPeople(
							await policy.resolveFoundationAccess(locals, 'READ'),
							'visitor'
						)
					).items.length,
					2
				);
				assert.equal(
					(
						await people.searchPeople(
							await policy.resolveFoundationAccess({ user: { id: 'second' } }, 'READ')
						)
					).items.length,
					0
				);
			}
		);
		await t.test(
			'consent, profile/browser binding, expiry, honeypot and Skip prevent unintended writes',
			async () => {
				const before = await count('FoundationSource');
				const f = await form();
				assert.equal((await submit(f, { contactConsent: '' })).status, 400);
				assert.equal((await submit(f, { captureToken: 'forged' })).status, 403);
				const wrong = await form('other');
				assert.equal((await submit(wrong, { captureToken: f.data.captureToken })).status, 403);
				const wrongBrowser = await form();
				assert.equal(
					(await submit(wrongBrowser, { captureToken: f.data.captureToken })).status,
					403
				);
				const expired = tokens.issueContactCaptureToken(
					'pilot-card',
					f.cookies.get(tokens.CAPTURE_COOKIE),
					'qr',
					Date.now() - 31 * 60 * 1000
				);
				assert.equal((await submit(f, { captureToken: expired })).status, 403);
				assert.equal((await submit(f, { website_check: 'bot' })).shared, true);
				assert.equal((await form('pilot', f.cookies)).data.createStep, false);
				assert.equal(
					(await route.load({ ...f.event, url: new URL(f.event.url + '?step=create') })).createStep,
					true
				);
				assert.equal(await count('FoundationSource'), before);
				await assert.rejects(
					submit(f, { intent: 'create-profile' }),
					(e) => e.status === 303 && e.location.startsWith('/auth/register')
				);
				assert.equal(await count('FoundationSource'), before);
			}
		);
		await t.test(
			'visitor capability denies private reads, mutations, processing and escaped transactions',
			async () => {
				const f = await form();
				const browser = f.cookies.get(tokens.CAPTURE_COOKIE);
				let escaped;
				for (const attempt of [
					(tx) => tx.foundationSubject.findMany(),
					(tx) => tx.foundationSource.count(),
					(tx) => tx.foundationSource.findFirst({ where: { id: sourceId }, select: { id: true } }),
					(tx) =>
						tx.foundationSourceVersion.findFirst({
							where: { sourceId, version: 1 },
							select: { payloadEnc: true }
						}),
					(tx) =>
						tx.foundationSubject.update({ where: { id: personId }, data: { state: 'ARCHIVED' } }),
					(tx) =>
						tx.foundationSourceVersion.create({
							data: {
								version: 1,
								recordedByKind: 'VISITOR',
								processingAdmission: 'PRIVATE_ANALYSIS'
							}
						}),
					(tx) => tx.foundationStatement.findMany(),
					(tx) => tx.foundationMembership.findMany()
				])
					await assert.rejects(
						policy.withPublicCapture('pilot-card', f.data.captureToken, browser, attempt),
						/unavailable/
					);
				assert.equal(
					await policy.withPublicCapture('pilot-card', f.data.captureToken, browser, async (tx) => {
						escaped = tx;
						return 'private';
					}),
					undefined
				);
				await assert.rejects(escaped.foundationSubject.findMany());
				const p = await people.createPerspective(
					await policy.resolveFoundationAccess(locals, 'WRITE'),
					'OWNER_RECORDED'
				);
				await assert.rejects(
					evidence.appendSupportedStatement(
						await policy.resolveFoundationAccess(locals, 'RECORD_STATEMENT'),
						{
							key: 'unconsented-analysis',
							expectedVersion: 0,
							text: 'Inferred',
							subjectIds: [personId],
							perspectiveId: p.id,
							segmentId,
							mode: 'INFERRED',
							confidence: 'LOW'
						}
					),
					/unavailable/
				);
			}
		);
		await t.test(
			'late storage failure rolls back person, source and receipt and returns only redacted diagnostics',
			async () => {
				const f = await form();
				const before = await count('FoundationSubject');
				const sources = await count('FoundationSource');
				await db.exec(`CREATE FUNCTION reject_test_capture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private visitor@example.test payload'; END $$;
        CREATE TRIGGER reject_test_capture BEFORE INSERT ON "FoundationEvidenceSubject" FOR EACH ROW EXECUTE FUNCTION reject_test_capture()`);
				const logs = [],
					original = console.error;
				console.error = (...items) => logs.push(items.join(' '));
				let result;
				try {
					result = await submit(f);
				} finally {
					console.error = original;
					await db.exec(
						'DROP TRIGGER reject_test_capture ON "FoundationEvidenceSubject"; DROP FUNCTION reject_test_capture()'
					);
				}
				assert.equal(result.status, 503);
				assert.ok(result.data.reference);
				assert.ok(logs.length);
				assert.ok(!logs.join('').includes(values.email));
				assert.equal(await count('FoundationSubject'), before);
				assert.equal(await count('FoundationSource'), sources);
				assert.equal((await form('pilot', f.cookies)).data.createStep, false);
				assert.equal((await submit(f)).shared, true);
			}
		);
		await t.test(
			'unpublished, suspended and locked destinations fail without a legacy fallback',
			async () => {
				const f = await form('other');
				await db.exec(`UPDATE "Profile" SET "isPublished"=false WHERE id='other-card'`);
				await assert.rejects(submit(f), (e) => e.status === 404);
				await db.exec(
					`UPDATE "Profile" SET "isPublished"=true WHERE id='other-card'; UPDATE "FoundationEnrollment" SET state='SUSPENDED',epoch=epoch+1 WHERE "userId"='pilot'`
				);
				assert.equal((await submit(f)).status, 503);
				await db.exec(
					`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1 WHERE "userId"='pilot'; UPDATE "FoundationVault" SET state='LOCKED' WHERE "ownerUserId"='pilot'`
				);
				assert.equal((await submit(f)).status, 503);
				await db.exec(`UPDATE "FoundationVault" SET state='ACTIVE' WHERE "ownerUserId"='pilot'`);
				assert.equal(await count('Contact'), 0);
			}
		);
		await t.test('persistent profile cap and local visitor cap retain retry receipts', async () => {
			const cookies = jar();
			let firstLimited;
			for (let i = 0; i < 10; i++) {
				const f = await form('limit', cookies);
				firstLimited ??= f;
				assert.equal((await submit(f)).shared, true);
			}
			assert.equal((await submit(await form('limit', cookies))).status, 429);
			assert.equal((await submit(firstLimited)).shared, true);
			for (let i = 0; i < 90; i++) assert.equal((await submit(await form('limit'))).shared, true);
			assert.equal((await submit(await form('limit'))).status, 429);
			assert.equal((await submit(firstLimited)).shared, true);
		});
		await t.test(
			'LEGACY and PREPARED public destinations retain Contact-only capture',
			async () => {
				assert.equal((await submit(await form('legacy'))).shared, true);
				await provision.prepareFoundationAccount('legacy');
				assert.equal((await submit(await form('legacy'))).shared, true);
				assert.equal(await count('Contact'), 2);
				assert.equal(await count('Interaction'), 2);
				assert.equal(
					(
						await db.query(
							`SELECT count(*)::int AS n FROM "FoundationSource" WHERE "ownerUserId"='legacy'`
						)
					).rows[0].n,
					0
				);
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
