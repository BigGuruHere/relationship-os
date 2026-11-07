// Actual guarded Prisma operations on a disposable database. Never use the app's DATABASE_URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createServer } from 'vite';

const run = promisify(execFile);
const endpoint = process.env.P305_TEST_DATABASE_URL;
test('P-305 privacy operations on a disposable database', { timeout: 120000 }, async (t) => {
	let db, socket, vite, prisma, snapshot, outputDir;
	try {
		if (endpoint) {
			const url = new URL(endpoint);
			assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
			assert.match(url.pathname, /^\/relish_p305_[a-z0-9_]+$/);
			assert.equal(url.search, '');
			const { Client } = await import('pg');
			const client = new Client({ connectionString: endpoint });
			await client.connect();
			db = {
				exec: (sql) => client.query(sql),
				query: (...args) => client.query(...args),
				close: () => client.end()
			};
			const { rows } = await db.query(
				"SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'"
			);
			assert.equal(rows[0].n, 0);
		} else db = await PGlite.create();
		await db.exec(`CREATE TYPE "UserRole" AS ENUM ('member');
			CREATE TABLE "User" (id text PRIMARY KEY, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), role "UserRole" NOT NULL DEFAULT 'member');
			INSERT INTO "User" VALUES ('pilot'),('second'),('legacy');`);
		await db.exec(
			await readFile(
				'prisma/migrations/20261104010000_f202_foundation_schema/migration.sql',
				'utf8'
			)
		);
		await db.exec(
			'CREATE TABLE "Profile" (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id))'
		);
		for (const name of [
			'20261107010000_s402_exchange_claims',
			'20261107020000_s402b_exchange_service',
            '20261107030000_s405c_account_channels'
		]) {
			await db.exec(await readFile('prisma/migrations/' + name + '/migration.sql', 'utf8'));
		}

		if (!endpoint) {
			socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 1 });
			await socket.start();
		}
		process.env.DATABASE_URL = endpoint
			? endpoint + '?connection_limit=3'
			: 'postgresql://postgres:postgres@' + socket.getServerConn() + '/postgres?connection_limit=1';
		process.env.SECRET_MASTER_KEY = 'a'.repeat(64);
		process.env.SESSION_COOKIE_SECRET = 'synthetic-only-p305';
		process.env.DB_KEEPALIVE_ENABLED = 'NO';
		vite = await createServer({
			configFile: false,
			server: { middlewareMode: true, hmr: false },
			resolve: { alias: { $lib: resolve('src/lib') } }
		});
		const load = (name) => vite.ssrLoadModule('/src/' + name + '.ts');
		({ prisma } = await load('lib/db'));
		const provision = await load('lib/server/foundation/provisioning');
		const policy = await load('lib/server/foundation/policy');
		const people = await load('lib/server/foundation/subjects');
		const evidence = await load('lib/server/foundation/evidence');
		const privacy = await load('lib/server/foundation/privacyOperations');
		const drafts = await load('lib/server/foundation/drafts');
		const routing = await load('lib/server/foundation/peopleRouting');
		const archive = (await load('routes/people/[id]/+page.server')).actions.archive;
		const { decrypt, encrypt } = await load('lib/crypto');
		const root = await provision.prepareFoundationAccount('pilot');
		await provision.prepareFoundationAccount('second');
		await db.exec(`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1`);
		const owner = { user: { id: 'pilot' } };
		const other = { user: { id: 'second' } };
		const grant = (op, locals = owner) => policy.resolveFoundationAccess(locals, op);
		const writer = await grant('WRITE');
		const person = await people.createPerson(writer, 'Private contact', {
			email: 'private@example.test'
		});
		const second = await people.createPerson(await grant('WRITE', other), 'Other owner secret');
		const relationship = await people.createRelationship(writer, 'Private relationship', [
			root.selfSubjectId,
			person.id
		]);
		const noteInput = {
			key: 'fixture-note',
			expectedVersion: 0,
			text: 'Original private note',
			start: 0,
			end: 8,
			quote: 'Original',
			subjectIds: [person.id],
			allowPrivateAnalysis: true
		};
		const original = await evidence.appendOwnerNote(await grant('RECORD_EVIDENCE'), noteInput);
		const corrected = await evidence.appendOwnerNote(await grant('RECORD_EVIDENCE'), {
			...noteInput,
			expectedVersion: 1,
			text: 'Updated private note',
			end: 7,
			quote: 'Updated',
			summary: 'Reviewed summary'
		});
		const perspective = await people.createPerspective(writer, 'OWNER_RECORDED');
		const claim = {
			key: 'fixture-claim',
			expectedVersion: 0,
			text: 'Private observation',
			subjectIds: [person.id],
			perspectiveId: perspective.id,
			segmentId: corrected.segmentId,
			mode: 'OBSERVED',
			confidence: 'LOW'
		};
		await evidence.appendSupportedStatement(await grant('RECORD_STATEMENT'), claim);
		await evidence.appendSupportedStatement(await grant('RECORD_STATEMENT'), {
			...claim,
			expectedVersion: 1,
			text: 'Corrected observation'
		});

		// Include a context edge and membership in the erased dependency graph.
		await db.query(
			'INSERT INTO "FoundationContext" (id,"ownerUserId","vaultId","labelEnc") VALUES ($1,$2,$3,$4)',
			[
				'context',
				'pilot',
				root.vaultId,
				encrypt(
					'Private context',
					'foundation:v1:FoundationContext:labelEnc:pilot:' + root.vaultId + ':context'
				)
			]
		);
		await db.query(
			'INSERT INTO "FoundationContextAssociation" (id,"ownerUserId","vaultId","contextId","segmentId") VALUES ($1,$2,$3,$4,$5)',
			['context-link', 'pilot', root.vaultId, 'context', corrected.segmentId]
		);

		await t.test(
			'archive route hides the person and linked history while retaining reviewed records',
			async () => {
				for (const [locals, id] of [
					[other, person.id],
					[owner, second.id],
					[owner, root.selfSubjectId],
					[owner, relationship.id],
					[{ user: { id: 'legacy' } }, person.id]
				]) {
					await assert.rejects(archive({ locals, params: { id } }), (e) => e.status === 404);
				}
				await assert.rejects(
					archive({ locals: owner, params: { id: person.id } }),
					(e) => e.status === 303 && e.location === '/people'
				);
				assert.equal((await people.searchPeople(await grant('READ'))).items.length, 0);
				await assert.rejects(
					evidence.listPersonNotes(await grant('READ_NOTES'), person.id),
					/unavailable/
				);
				await assert.rejects(
					evidence.readEvidenceSegment(await grant('READ_SEGMENT'), original.segmentId),
					/unavailable/
				);
				const review = await privacy.reviewFoundationPrivacy('pilot');
				assert.equal(review.subjects.find((row) => row.id === person.id).state, 'ARCHIVED');
				assert.equal(review.sourceVersions.length, 2);
				assert.ok(review.sourceVersions.some((row) => row.text === noteInput.text));
				assert.ok(review.sourceVersions.some((row) => row.reviewedSummary === 'Reviewed summary'));
				assert.equal(review.statementVersions.length, 2);
				assert.equal(review.memberships.length, 2);
				assert.equal(review.contextAssociations.length, 1);
				assert.doesNotMatch(
					JSON.stringify(review),
					/Other owner secret|contentMac|ingestKey|provenanceEnc/
				);
				await assert.rejects(privacy.reviewFoundationPrivacy('legacy'), /unavailable/);
			}
		);

		await t.test(
			'operator CLI validates target and confirmation, emits only metadata, and protects review files',
			async () => {
				outputDir = await mkdtemp(join(tmpdir(), 'relish-p305-fixture-'));
				const caseRef = randomUUID(),
					path = join(outputDir, 'review.json');
				const target = new URL(process.env.DATABASE_URL);
				const env = {
					...process.env,
					P305_EXPECTED_TARGET: target.host + target.pathname,
					P305_CONFIRM: ''
				};
				const cli = async (command, args = [], overrides = {}) => {
					// The embedded socket shares prepared statements between clients.
					if (!endpoint) await db.exec('DEALLOCATE ALL');
					return run(
						process.execPath,
						[
							'--import',
							'tsx',
							'scripts/foundation-privacy.ts',
							command,
							caseRef,
							'pilot',
							...args
						],
						{ env: { ...env, ...overrides }, timeout: 15000 }
					);
				};
				const rejection = async (promise) => {
					await assert.rejects(promise, (e) => {
						const logged = JSON.parse(e.stderr.trim());
						assert.match(logged.reference, /^[0-9a-f-]{36}$/);
						assert.doesNotMatch(
							e.stderr,
							/private@example.test|Original private note|postgresql:|pilot/
						);
						return e.code === 1;
					});
				};
				await rejection(cli('inspect', [], { P305_EXPECTED_TARGET: 'incorrect' }));
				await rejection(
					cli('inspect', [], { DATABASE_URL: process.env.DATABASE_URL + '&options=bad' })
				);
				await rejection(cli('suspend'));
				await rejection(cli('erase', [], { P305_CONFIRM: 'erase:second:' + caseRef }));
				// Release the fixture's pooled socket before a standalone operator process connects.
				await prisma.$disconnect();
				assert.equal(JSON.parse((await cli('inspect')).stdout).enrollment, 'ACTIVE');
				const result = await cli('review', [path]);
				assert.doesNotMatch(result.stdout, /private@example.test|Original private note/);
				assert.equal((await stat(path)).mode & 0o777, 0o600);
				const before = await readFile(path, 'utf8');
				assert.match(before, /private@example.test/);
				await rejection(cli('review', [path]));
				assert.equal(await readFile(path, 'utf8'), before);
				if (!endpoint) await db.exec('DEALLOCATE ALL');
			}
		);

		await t.test(
			'suspension blocks all old authority and leaves legacy paths isolated',
			async () => {
				await assert.rejects(privacy.eraseFoundationPrivacy('pilot'), /unavailable/);
				const read = await grant('READ');
				const processing = await drafts.resolveDraftProcessing(owner);
				const before = await privacy.inspectFoundationPrivacy('pilot');
				const suspended = await privacy.suspendFoundationPrivacy('pilot');
				assert.deepEqual(suspended, {
					enrollment: 'SUSPENDED',
					vault: 'LOCKED',
					epoch: before.epoch + 1
				});
				assert.deepEqual(await privacy.suspendFoundationPrivacy('pilot'), suspended);
				await assert.rejects(people.searchPeople(read), /unavailable/);
				await assert.rejects(processing.authorize(), /unavailable/);
				await assert.rejects(
					routing.peopleRouteDomain('pilot', '/people'),
					(e) => e.status === 503
				);
				assert.equal(await routing.peopleRouteDomain('legacy', '/people'), 'LEGACY');
				assert.equal(
					await provision.withLegacyAccountClaims(
						'pilot',
						() => assert.fail('legacy fallback'),
						'blocked'
					),
					'blocked'
				);
				assert.equal((await privacy.reviewFoundationPrivacy('pilot')).sourceVersions.length, 2);
			}
		);

		if (!endpoint) snapshot = await db.dumpDataDir();
		await t.test(
			'late erasure failure rolls back the entire graph and retry keeps other accounts intact',
			async () => {
				const review = await privacy.reviewFoundationPrivacy('pilot');
				const otherReview = await privacy.reviewFoundationPrivacy('second');
				await db.exec(`CREATE FUNCTION reject_p305() RETURNS trigger LANGUAGE plpgsql AS $$
				BEGIN RAISE EXCEPTION 'fixture erasure failure'; END $$;
				CREATE TRIGGER reject_p305 BEFORE DELETE ON "FoundationSubject" FOR EACH ROW EXECUTE FUNCTION reject_p305()`);
				try {
					await assert.rejects(privacy.eraseFoundationPrivacy('pilot'));
					assert.deepEqual(await privacy.reviewFoundationPrivacy('pilot'), review);
				} finally {
					await db.exec(
						'DROP TRIGGER reject_p305 ON "FoundationSubject"; DROP FUNCTION reject_p305()'
					);
				}
				assert.ok((await privacy.eraseFoundationPrivacy('pilot')).erasedRows > 0);
				assert.equal((await privacy.eraseFoundationPrivacy('pilot')).erasedRows, 0);
				const empty = await privacy.reviewFoundationPrivacy('pilot');
				for (const value of Object.values(empty))
					if (Array.isArray(value)) assert.deepEqual(value, []);
				assert.deepEqual(await privacy.reviewFoundationPrivacy('second'), otherReview);
				assert.equal((await db.query('SELECT count(*)::int n FROM "User"')).rows[0].n, 3);
				assert.equal(await provision.accountDomain('pilot'), 'SUSPENDED');
			}
		);

		if (snapshot)
			await t.test(
				'restore to a fresh database, verify the encrypted graph and replay the erasure',
				async () => {
					const restored = await PGlite.create({ loadDataDir: snapshot });
					let restoreSocket, restoreVite, restorePrisma;
					const savedUrl = process.env.DATABASE_URL;
					try {
						const { rows } = await restored.query(
							'SELECT id,"payloadEnc" FROM "FoundationSourceVersion" WHERE "ownerUserId"=$1 AND version=2',
							['pilot']
						);
						assert.equal(rows.length, 1);
						assert.equal(
							decrypt(
								rows[0].payloadEnc,
								`foundation:v1:FoundationSourceVersion:payloadEnc:pilot:${root.vaultId}:${rows[0].id}`
							),
							'Updated private note'
						);
						const enrollment = await restored.query(
							'SELECT state FROM "FoundationEnrollment" WHERE "userId"=$1',
							['pilot']
						);
						assert.equal(enrollment.rows[0].state, 'SUSPENDED');
						// Use a separate app client against the restored copy, never rebind the original.
						restoreSocket = new PGLiteSocketServer({
							db: restored,
							host: '127.0.0.1',
							port: 0,
							maxConnections: 1
						});
						await restoreSocket.start();
						process.env.DATABASE_URL =
							'postgresql://postgres:postgres@' +
							restoreSocket.getServerConn() +
							'/postgres?connection_limit=1';
						delete globalThis.prisma;
						restoreVite = await createServer({
							configFile: false,
							server: { middlewareMode: true, hmr: false },
							resolve: { alias: { $lib: resolve('src/lib') } }
						});
						({ prisma: restorePrisma } = await restoreVite.ssrLoadModule('/src/lib/db.ts'));
						const restoredPrivacy = await restoreVite.ssrLoadModule(
							'/src/lib/server/foundation/privacyOperations.ts'
						);
						assert.equal(
							(await restoredPrivacy.reviewFoundationPrivacy('pilot')).sourceVersions.length,
							2
						);
						assert.ok((await restoredPrivacy.eraseFoundationPrivacy('pilot')).erasedRows > 0);
						assert.equal(
							(await restoredPrivacy.reviewFoundationPrivacy('pilot')).sourceVersions.length,
							0
						);
						assert.equal((await restoredPrivacy.inspectFoundationPrivacy('second')).subjects, 2);
					} finally {
						if (restorePrisma) await restorePrisma.$disconnect();
						if (restoreVite) await restoreVite.close();
						if (restoreSocket) await restoreSocket.stop();
						await restored.close();
						process.env.DATABASE_URL = savedUrl;
					}
				}
			);
		await t.test(
			'hosted rehearsal command refuses the source and seeds only a credential-free PREPARED fixture',
			async () => {
				await prisma.$disconnect();
				const caseRef = randomUUID();
				const account = 'p306-' + caseRef;
				const url = new URL(process.env.DATABASE_URL);
				const base = {
					...process.env,
					P305_EXPECTED_TARGET: url.host + url.pathname,
					P306_SOURCE_TARGET: 'dev.example.invalid' + url.pathname,
					P306_CONFIRM: 'seed:' + caseRef
				};
				async function cli(script, args, overrides = {}) {
					// Separate Prisma processes share prepared statements only in this embedded fixture.
					if (!endpoint) await db.exec('DEALLOCATE ALL');
					return run(process.execPath, ['--import', 'tsx', 'scripts/' + script, ...args], {
						env: { ...base, ...overrides },
						timeout: 15000
					});
				}
				const fixture = 'foundation-restore-rehearsal.ts';
				await assert.rejects(
					cli(fixture, ['seed', caseRef], { P306_SOURCE_TARGET: url.host + url.pathname })
				);
				await assert.rejects(cli(fixture, ['seed', caseRef], { P306_CONFIRM: '' }));
				assert.equal(
					(await db.query('SELECT count(*)::int n FROM "User" WHERE id=$1', [account])).rows[0].n,
					0
				);
				const { stdout } = await cli(fixture, ['seed', caseRef]);
				assert.deepEqual(JSON.parse(stdout), {
					caseRef,
					account,
					verified: 'prepared',
					enrollment: 'PREPARED',
					vault: 'ACTIVE',
					subjects: 2,
					sources: 1,
					versions: 2
				});
				assert.doesNotMatch(stdout, /synthetic note|postgresql:/);
				await assert.rejects(cli(fixture, ['seed', caseRef]));
				const privacyCli = 'foundation-privacy.ts';
				await cli(privacyCli, ['suspend', caseRef, account], {
					P305_CONFIRM: 'suspend:' + account + ':' + caseRef
				});
				assert.equal(
					JSON.parse((await cli(fixture, ['verify', caseRef, 'suspended'])).stdout).verified,
					'suspended'
				);
				await cli(privacyCli, ['erase', caseRef, account], {
					P305_CONFIRM: 'erase:' + account + ':' + caseRef
				});
				assert.equal(
					JSON.parse((await cli(fixture, ['verify', caseRef, 'erased'])).stdout).verified,
					'erased'
				);
			}
		);
	} finally {
		if (prisma) await prisma.$disconnect();
		if (vite) await vite.close();
		if (socket) await socket.stop();
		if (db) await db.close();
		if (outputDir) await rm(outputDir, { recursive: true, force: true });
		delete globalThis.prisma;
	}
});
