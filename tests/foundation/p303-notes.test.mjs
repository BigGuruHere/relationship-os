// Exercise the shipped adapters with synthetic accounts. All SQL lives in an in-memory database.
import test from 'node:test';
import { randomUUID } from 'node:crypto';
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

test('P-303 private notes and transient draft processing', { timeout: 120000 }, async (t) => {
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
					enforce: 'pre',
					resolveId(id) {
						if (id.endsWith('/src/lib/ai') || id === '$lib/ai') return '\0p303-ai';
						if (id === '$app/environment') return '\0f206-environment';
					},
					load(id) {
						if (id === '\0p303-ai' || id.endsWith('/src/lib/ai.ts'))
							return 'export const transcribeAudio = (...args) => globalThis.__p303Provider.transcribe(...args); export const summarizeText = (...args) => globalThis.__p303Provider.summarize(...args);';
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

		const noteRoute = await load('routes/people/[id]/notes/new/+page.server');
		const detail = await load('routes/people/[id]/+page.server');
		const summarize = await load('routes/people/[id]/notes/summarize/+server');
		const upload = await load('routes/people/api/upload-chunk/+server');
		const poll = await load('routes/people/api/transcribe-result/+server');
		const rawPoll = await load('routes/api/transcribe-result/+server');
		const drafts = await load('lib/server/foundation/drafts');
		await provision.prepareFoundationAccount('pilot');
		await provision.prepareFoundationAccount('second');
		await db.exec(`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1`);
		const locals = { user: { id: 'pilot' } };
		const other = { user: { id: 'second' } };
		const person = await people.createPerson(
			await policy.resolveFoundationAccess(locals, 'WRITE'),
			'Test person'
		);
		const params = { id: person.id };
		const base = 'https://fixture.invalid/people/' + person.id;
		const page = await noteRoute.load({ locals, params });
		const original = {
			text: 'A private observation',
			summary: 'Reviewed summary',
			channel: 'note',
			saveKey: page.saveKey
		};
		const save = (change = {}, who = locals) =>
			noteRoute.actions.save({
				locals: who,
				params,
				request: new Request(base + '/notes/new?/save', {
					method: 'POST',
					body: new URLSearchParams({ ...original, ...change })
				})
			});
		const history = () => detail.load({ locals, params, url: new URL(base) });
		const count = async (table) =>
			(await db.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;
		const saved = (promise) =>
			assert.rejects(
				promise,
				(e) => e.status === 303 && e.location === base.replace('https://fixture.invalid', '')
			);
		globalThis.__p303Provider = {
			transcribe: async () => 'Voice draft',
			summarize: async () => ({ summary: 'Draft summary' })
		};
		const summaryRequest = () =>
			summarize.POST({
				locals,
				params,
				request: new Request(base + '/notes/summarize', {
					method: 'POST',
					body: JSON.stringify({ text: 'Only the submitted draft' })
				})
			});
		const audio = (key = randomUUID(), who = locals, index = 0, last = 1) => {
			const url = new URL(
				'https://fixture.invalid/people/api/upload-chunk?key=' +
					key +
					'&index=' +
					index +
					'&last=' +
					last
			);
			return upload.POST({
				locals: who,
				url,
				request: new Request(url, { method: 'POST', body: new Uint8Array([1, 2, 3]) })
			});
		};
		const result = (jobId, who = locals) =>
			poll.GET({
				locals: who,
				url: new URL('https://fixture.invalid/people/api/transcribe-result?jobId=' + jobId)
			});
		async function finish(jobId) {
			for (let i = 0; i < 100; i++) {
				const response = await result(jobId);
				const body = await response.json();
				if (body.status === 'done' || body.status === 'error') return { response, body };
				await new Promise((resolve) => setTimeout(resolve, 20));
			}
			assert.fail('transcription did not settle');
		}
		await t.test(
			'typed save, encrypted storage and refresh preserve full text without legacy writes',
			async () => {
				assert.match(page.saveKey, /^[0-9a-f-]{36}$/);
				assert.equal(page.foundation, true);
				await saved(save({ allowPrivateAnalysis: 'true', ownerUserId: 'second' }));
				const data = await history();
				assert.equal(data.notes.length, 1);
				assert.equal(data.notes[0].text, original.text);
				assert.equal(data.notes[0].summary, original.summary);
				const version = (await db.query('SELECT * FROM "FoundationSourceVersion"')).rows[0];
				assert.equal(version.processingAdmission, 'STORED_ONLY');
				assert.ok(!version.payloadEnc.includes(original.text));
				assert.equal(await count('Interaction'), 0);
				assert.equal(await count('Contact'), 0);
			}
		);
		await t.test(
			'lost-response retry saves once; changed retry retains draft and original',
			async () => {
				await saved(save());
				assert.equal(await count('FoundationSource'), 1);
				const failed = await save({ text: 'Changed draft' });
				assert.equal(failed.status, 409);
				assert.equal(failed.data.draft.text, 'Changed draft');
				assert.equal(failed.data.draft.saveKey, page.saveKey);
				assert.equal((await history()).notes[0].text, original.text);
			}
		);
		await t.test(
			'voice save retains text beyond the excerpt and rejects invalid drafts',
			async () => {
				const text = 'x'.repeat(7999) + '😀' + 'z'.repeat(1000);
				await saved(save({ saveKey: randomUUID(), text, channel: 'voice note' }));
				const notes = (await history()).notes;
				assert.ok(notes.some((n) => n.text === text && n.channel === 'OWNER_VOICE_NOTE'));
				assert.equal((await save({ saveKey: randomUUID(), text: '' })).status, 400);
				assert.equal((await save({ saveKey: randomUUID(), text: 'x'.repeat(64001) })).status, 400);
			}
		);
		await t.test('foreign owner and forged history cursor cannot read or write notes', async () => {
			await assert.rejects(save({}, other), (e) => e.status === 404);
			await assert.rejects(
				detail.load({ locals: other, params, url: new URL(base) }),
				(e) => e.status === 404
			);
			await assert.rejects(
				detail.load({ locals, params, url: new URL(base + '?afterNote=' + randomUUID()) }),
				(e) => e.status === 404
			);
		});
		await t.test(
			'late database failure preserves retry key and rolls back all evidence',
			async () => {
				const n = await count('FoundationSource'),
					key = randomUUID();
				await db.exec(
					`CREATE FUNCTION reject_note() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER reject_note BEFORE INSERT ON "FoundationEvidenceSubject" FOR EACH ROW EXECUTE FUNCTION reject_note()`
				);
				try {
					const failed = await save({ saveKey: key });
					assert.equal(failed.status, 503);
					assert.equal(failed.data.draft.saveKey, key);
					assert.equal(failed.data.draft.text, original.text);
					assert.equal(await count('FoundationSource'), n);
				} finally {
					await db.exec(
						'DROP TRIGGER reject_note ON "FoundationEvidenceSubject"; DROP FUNCTION reject_note()'
					);
				}
				await saved(save({ saveKey: key }));
				assert.equal(await count('FoundationSource'), n + 1);
			}
		);

		await t.test(
			'correction shows current full note while original evidence remains exact',
			async () => {
				const access = await policy.resolveFoundationAccess(locals, 'RECORD_EVIDENCE');
				const input = {
					key: 'correction-case',
					expectedVersion: 0,
					text: 'Original note',
					start: 0,
					end: 13,
					quote: 'Original note',
					subjectIds: [person.id],
					allowPrivateAnalysis: false
				};
				const first = await evidence.appendOwnerNote(access, input);
				await evidence.appendOwnerNote(access, {
					...input,
					expectedVersion: 1,
					text: 'Corrected note',
					quote: 'Corrected note',
					end: 14
				});
				const notes = (await history()).notes;
				assert.equal(notes.filter((n) => n.id === first.sourceId).length, 1);
				assert.equal(notes.find((n) => n.id === first.sourceId).text, 'Corrected note');
				const segment = await evidence.readEvidenceSegment(
					await policy.resolveFoundationAccess(locals, 'READ_SEGMENT'),
					first.segmentId
				);
				assert.equal(segment.excerpt, 'Original note');
				await db.exec(
					`UPDATE "FoundationSource" SET state='DISABLED' WHERE id='${first.sourceId}'`
				);
				assert.ok(!(await history()).notes.some((n) => n.id === first.sourceId));
			}
		);
		await t.test('history pagination remains bounded and explicit', async () => {
			const p = await people.createPerson(
				await policy.resolveFoundationAccess(locals, 'WRITE'),
				'Paged person'
			);
			const access = await policy.resolveFoundationAccess(locals, 'RECORD_EVIDENCE');
			for (let i = 0; i < 51; i++)
				await evidence.appendOwnerNote(access, {
					key: 'page-' + i,
					expectedVersion: 0,
					text: 'Page ' + i,
					start: 0,
					end: 4,
					quote: 'Page',
					subjectIds: [p.id],
					allowPrivateAnalysis: false
				});
			const read = await policy.resolveFoundationAccess(locals, 'READ_NOTES');
			const first = await evidence.listPersonNotes(read, p.id);
			assert.equal(first.notes.length, 50);
			assert.ok(first.next);
			const second = await evidence.listPersonNotes(read, p.id, first.next);
			assert.equal(second.notes.length, 1);
			assert.equal(second.next, null);
			assert.equal(new Set([...first.notes, ...second.notes].map((n) => n.id)).size, 51);
		});
		await t.test(
			'processing authority cannot read stored data or substitute for note retrieval',
			async () => {
				const access = await policy.resolveFoundationAccess(locals, 'PROCESS_DRAFT');
				await assert.rejects(
					policy.withFoundationAccess(access, 'PROCESS_DRAFT', (tx) =>
						tx.foundationSourceVersion.findMany()
					),
					/unavailable/
				);
				await assert.rejects(evidence.listPersonNotes(access, person.id), /unavailable/);
				const scope = await drafts.resolveDraftProcessing(locals);
				await db.exec(`UPDATE "FoundationEnrollment" SET epoch=epoch+1 WHERE "userId"='pilot'`);
				await assert.rejects(scope.authorize(), /unavailable/);
			}
		);
		await t.test('summary success and failure leave stored evidence unchanged', async () => {
			const n = await count('FoundationSource');
			assert.equal((await (await summaryRequest()).json()).summary, 'Draft summary');
			globalThis.__p303Provider.summarize = async () => {
				throw Error('private provider details');
			};
			const failure = await summaryRequest();
			assert.equal(failure.status, 503);
			assert.ok(!(await failure.text()).includes('private provider details'));
			assert.equal(await count('FoundationSource'), n);
		});
		await t.test('summary result is withheld after revocation during provider work', async () => {
			globalThis.__p303Provider.summarize = async () => {
				await db.exec(
					`UPDATE "FoundationEnrollment" SET state='SUSPENDED',epoch=epoch+1 WHERE "userId"='pilot'`
				);
				return { summary: 'Must not return' };
			};
			try {
				const response = await summaryRequest();
				assert.equal(response.status, 503);
				assert.ok(!(await response.text()).includes('Must not return'));
			} finally {
				await db.exec(
					`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1 WHERE "userId"='pilot'`
				);
			}
		});
		await t.test(
			'audio result is owner/domain bound and retryable without storing a note',
			async () => {
				const n = await count('FoundationSource');
				const response = await audio();
				assert.equal(response.status, 202);
				const { jobId } = await response.json();
				const done = await finish(jobId);
				assert.equal(done.body.transcript, 'Voice draft');
				assert.equal((await (await result(jobId)).json()).transcript, 'Voice draft');
				assert.equal((await result(jobId, other)).status, 404);
				const legacy = await rawPoll.GET({
					locals: { ...locals, contextSpaceId: 'pretend' },
					url: new URL('https://fixture.invalid/api/transcribe-result?jobId=' + jobId)
				});
				assert.equal(legacy.status, 404);
				assert.equal(await count('FoundationSource'), n);
				assert.equal((await result(randomUUID())).status, 404);
			}
		);
		await t.test(
			'queued audio rejects later chunks and revoked work cannot expose transcript',
			async () => {
				let release, entered;
				const started = new Promise((resolve) => (entered = resolve));
				globalThis.__p303Provider.transcribe = async () => {
					entered();
					await new Promise((resolve) => (release = resolve));
					return 'Revoked transcript';
				};
				const key = randomUUID(),
					response = await audio(key),
					{ jobId } = await response.json();
				await started;
				assert.equal((await audio(key, locals, 1)).status, 409);
				assert.equal((await audio(key, other, 1)).status, 409);
				await db.exec(
					`UPDATE "FoundationEnrollment" SET state='SUSPENDED',epoch=epoch+1 WHERE "userId"='pilot'`
				);
				await assert.rejects(result(jobId), (e) => e.status === 503);
				release();
				await db.exec(
					`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1 WHERE "userId"='pilot'`
				);
				assert.equal((await result(jobId)).status, 404);
			}
		);
		await t.test('empty and failed transcription return recoverable errors', async () => {
			for (const implementation of [
				async () => '',
				async () => {
					throw Error('private provider failure');
				}
			]) {
				globalThis.__p303Provider.transcribe = implementation;
				const { jobId } = await (await audio()).json();
				const done = await finish(jobId);
				assert.equal(done.response.status, 503);
				assert.equal(done.body.status, 'error');
				assert.ok(!JSON.stringify(done.body).includes('private provider'));
			}
		});
	} finally {
		if (prisma) await prisma.$disconnect();
		if (vite) await vite.close();
		if (socket) await socket.stop();
		await db.close();
		delete globalThis.prisma;
		delete globalThis.__p303Provider;
	}
});
