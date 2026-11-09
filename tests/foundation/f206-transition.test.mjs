// Exercise the shipped adapters with synthetic accounts. All SQL lives in an in-memory database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createServer } from 'vite';
import { legacySchemaFixture } from './legacy-schema-fixture.mjs';

test(
	'F-206 private foundation handoff and suspension rehearsal',
	{ timeout: 120000 },
	async (t) => {
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
			const capture = await load('lib/server/core/contactCapture');
			const custody = await load('lib/server/core/contextSpace');
			const contacts = await load('lib/server/core/contacts');
			const { createWorkspaceCoreAccess } = await load('lib/server/core/accessPolicy');
			const brokerage = await load('routes/broker/contacts/+page.server');
			const directory = await load('routes/people/+page.server');
			const homes = await load('lib/server/core/myPeople');
			async function signIn(id) {
				const session = await auth.createSession(id);
				const verified = await auth.getSessionFromCookie(session.cookie);
				assert.equal(verified?.user.id, id);
				return { user: { id: verified.user.id, role: verified.user.role } };
			}
			// Fixture operator only. Quiesced private writers, empty legacy private home on first handoff.
			async function transition(owner, from, epoch, to) {
				return db.transaction(async (tx) => {
					await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
						'foundation:account:' + owner
					]);
					if (from === 'PREPARED' && to === 'ACTIVE') {
						const existing = await tx.query(
							`SELECT EXISTS(SELECT 1 FROM "ContextSpace" s WHERE s."ownerUserId"=$1 AND s."domainKey"='private' AND
            (EXISTS(SELECT 1 FROM "Contact" c WHERE c."contextSpaceId"=s.id) OR EXISTS(SELECT 1 FROM "Interaction" i WHERE i."contextSpaceId"=s.id))) AS found`,
							[owner]
						);
						if (existing.rows[0].found) throw Error('Private data handoff required');
					}
					const result = await tx.query(
						'UPDATE "FoundationEnrollment" SET state=$1, epoch=epoch+1,"updatedAt"=now() WHERE "userId"=$2 AND state=$3 AND epoch=$4 RETURNING epoch',
						[to, owner, from, epoch]
					);
					if (result.rows.length !== 1) throw Error('Stale transition');
				});
			}
			const pilot = await signIn('pilot'),
				second = await signIn('second'),
				legacy = await signIn('legacy');
			const grant = (op, locals = pilot) => policy.resolveFoundationAccess(locals, op);
			const publicCapture = async (slug, nonce) => {
				const profile = await capture.publishedCaptureProfile(slug);
				return capture.capturePrivateContact(profile, {
					name: 'QR visitor',
					nonce,
					browser: 'synthetic-browser',
					via: 'qr'
				});
			};
			const inBusiness = (fn) =>
				custody.runWithWorkspaceCustody({ userId: 'pilot', contextSpaceId: 'pilot' }, fn);
			const business = await inBusiness(() =>
				contacts.createCoreContact(createWorkspaceCoreAccess('pilot', 'brokerage', 'pilot'), {
					name: 'Brokerage contact'
				})
			);
			async function checkBrokerage() {
				const result = await inBusiness(() => brokerage.load({ locals: pilot }));
				assert.deepEqual(
					result.contacts.map(({ id, name }) => ({ id, name })),
					[{ id: business.id, name: 'Brokerage contact' }]
				);
			}
			async function legacyDirectory(locals) {
				const space = await homes.privatePeopleSpace(locals.user.id);
				return custody.runWithWorkspaceCustody(
					{ userId: locals.user.id, contextSpaceId: space.id },
					() =>
						directory.load({
							locals: { ...locals, contextDomainKey: 'private', contextSpaceId: space.id },
							url: new URL('https://fixture.invalid/people')
						})
				);
			}
			await t.test(
				'legacy QR retry creates one private entry and receipt; Brokerage reads its original record',
				async () => {
					await publicCapture('legacy', 'same');
					await publicCapture('legacy', 'same');
					assert.deepEqual(
						(await legacyDirectory(legacy)).people.map((p) => p.name),
						['QR visitor']
					);
					assert.equal(
						(
							await db.query('SELECT count(*)::int AS n FROM "Interaction" WHERE "userId"=$1', [
								'legacy'
							])
						).rows[0].n,
						1
					);
					await checkBrokerage();
					await assert.rejects(grant('WRITE', legacy), /unavailable/);
				}
			);
			await t.test(
				'a withdrawn profile rolls back the first private home and its submission',
				async () => {
					const snapshot = await capture.publishedCaptureProfile('second');
					await db.exec(`UPDATE "Profile" SET "isPublished"=false WHERE id='second-card'`);
					await assert.rejects(
						capture.capturePrivateContact(snapshot, {
							name: 'Visitor',
							nonce: 'closed',
							browser: 'browser',
							via: 'qr'
						}),
						(e) => e.status === 404
					);
					assert.equal(await homes.privatePeopleSpace('second'), null);
					const rows = await db.query(
						'SELECT count(*)::int AS n FROM "Contact" WHERE "userId"=$1',
						['second']
					);
					assert.equal(rows.rows[0].n, 0);
				}
			);
			const pilotRoot = await provision.prepareFoundationAccount('pilot');
			await provision.prepareFoundationAccount('second');
			let before, activeRead, person, relation, perspective, note, claim, receipt, statement;
			await t.test(
				'handoff checks prior data and epoch; preparation gives no public foundation access',
				async () => {
					await provision.prepareFoundationAccount('legacy');
					await assert.rejects(transition('legacy', 'PREPARED', 1, 'ACTIVE'), /handoff required/);
					assert.equal(await provision.accountDomain('legacy'), 'PREPARED');
					await custody.runWithWorkspaceCustody(
						{ userId: 'second', contextSpaceId: 'second' },
						() => publicCapture('legacy', 'prepared')
					);
					assert.equal((await legacyDirectory(legacy)).people.length, 2);
					before = await policy.resolvePreparedFoundationAccess(pilot, 'READ');
					await assert.rejects(grant('READ'), /unavailable/);
					await transition('pilot', 'PREPARED', 1, 'ACTIVE');
					await transition('second', 'PREPARED', 1, 'ACTIVE');
					await assert.rejects(transition('pilot', 'PREPARED', 1, 'ACTIVE'), /Stale/);
					await assert.rejects(people.listPeople(before), /unavailable/);
					// P-302 requires a verified browser-bound form token for ACTIVE intake.
					await assert.rejects(publicCapture('pilot', 'active'), (e) => e.status === 403);
					await assert.rejects(
						prisma.$transaction((tx) => provision.requireLegacyPeopleDomain('pilot', tx)),
						(e) => e.status === 503
					);
					await checkBrokerage();
				}
			);
			await t.test(
				'active session creates a person, relationship, note, and independently attributed understanding',
				async () => {
					const write = await grant('WRITE');
					activeRead = await grant('READ_STATEMENT');
					person = await people.createPerson(write, 'Betty');
					relation = await people.createRelationship(write, 'Working together', [
						pilotRoot.selfSubjectId,
						person.id
					]);
					perspective = await people.createPerspective(write, 'ATTRIBUTED_PERSON', person.id);
					note = {
						key: 'meeting',
						expectedVersion: 0,
						text: 'Betty prefers advance notice.',
						start: 0,
						end: 28,
						quote: 'Betty prefers advance notice',
						subjectIds: [person.id, relation.id],
						speakerId: person.id,
						allowPrivateAnalysis: true
					};
					receipt = await evidence.appendOwnerNote(await grant('RECORD_EVIDENCE'), note);
					claim = {
						key: 'observation',
						expectedVersion: 0,
						text: 'Advance notice helps with planning.',
						subjectIds: [relation.id],
						perspectiveId: perspective.id,
						segmentId: receipt.segmentId,
						mode: 'OBSERVED',
						confidence: 'MEDIUM'
					};
					statement = await evidence.appendSupportedStatement(
						await grant('RECORD_STATEMENT'),
						claim
					);
					const view = await evidence.readCurrentStatement(activeRead, statement.statementId);
					assert.equal(view.text, claim.text);
					assert.deepEqual(view.subjectIds, [relation.id]);
					assert.equal(view.perspectiveId, perspective.id);
					await assert.rejects(
						people.readRelationship(await grant('READ', second), relation.id),
						/unavailable/
					);
					await assert.rejects(
						evidence.readEvidenceSegment(await grant('READ_SEGMENT', second), receipt.segmentId),
						/unavailable/
					);
					await assert.rejects(
						evidence.readCurrentStatement(
							await grant('READ_STATEMENT', second),
							statement.statementId
						),
						/unavailable/
					);
					await checkBrokerage();
				}
			);
			await t.test(
				'correction invalidates earlier support and reassessment uses the corrected version',
				async () => {
					const corrected = {
						...note,
						expectedVersion: 1,
						text: 'More notice helps.',
						start: 0,
						end: 11,
						quote: 'More notice'
					};
					const replacement = await evidence.appendOwnerNote(
						await grant('RECORD_EVIDENCE'),
						corrected
					);
					await assert.rejects(
						evidence.readCurrentStatement(activeRead, statement.statementId),
						/unavailable/
					);
					assert.equal(
						(await evidence.readEvidenceSegment(await grant('READ_SEGMENT'), receipt.segmentId))
							.excerpt,
						note.quote
					);
					const revised = await evidence.appendSupportedStatement(await grant('RECORD_STATEMENT'), {
						...claim,
						expectedVersion: 1,
						text: 'More notice helps Betty.',
						segmentId: replacement.segmentId
					});
					assert.equal(revised.statementId, statement.statementId);
					assert.equal(revised.version, 2);
				}
			);
			await t.test(
				'suspension stops private writes; resuming with fresh authority retains foundation and Brokerage records',
				async () => {
					await transition('pilot', 'ACTIVE', 2, 'SUSPENDED');
					await assert.rejects(
						evidence.readCurrentStatement(activeRead, statement.statementId),
						/unavailable/
					);
					await assert.rejects(grant('WRITE'), /unavailable/);
					await assert.rejects(publicCapture('pilot', 'suspended'), (e) => e.status === 503);
					await checkBrokerage();
					await transition('pilot', 'SUSPENDED', 3, 'ACTIVE');
					await assert.rejects(
						evidence.readCurrentStatement(activeRead, statement.statementId),
						/unavailable/
					);
					const recovered = await evidence.readCurrentStatement(
						await grant('READ_STATEMENT', await signIn('pilot')),
						statement.statementId
					);
					assert.equal(recovered.version, 2);
					assert.equal(recovered.text, 'More notice helps Betty.');
					assert.deepEqual(
						(await people.listPeople(await grant('READ'))).items.map((p) => p.id).sort(),
						[pilotRoot.selfSubjectId, person.id].sort()
					);
					const rows = await db.query(
						'SELECT count(*)::int AS n FROM "Contact" WHERE "userId"=$1',
						['pilot']
					);
					assert.equal(rows.rows[0].n, 1);
					await checkBrokerage();
				}
			);
		} finally {
			if (prisma) await prisma.$disconnect();
			if (vite) await vite.close();
			if (socket) await socket.stop();
			await db.close();
			delete globalThis.prisma;
		}
	}
);
