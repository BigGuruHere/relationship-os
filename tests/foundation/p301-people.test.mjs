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

test('P-301 private People routes and cohort isolation', { timeout: 120000 }, async (t) => {
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

		const directory = await load('routes/people/+page.server');
		const add = await load('routes/people/new/+page.server');
		const detail = await load('routes/people/[id]/+page.server');
		const hooks = await load('hooks.server');
		const layout = await load('routes/+layout.server');
		const crypto = await load('lib/crypto');
		const locals = { user: { id: 'pilot', role: 'member' } };
		const second = { user: { id: 'second', role: 'member' } };
		const root = await provision.prepareFoundationAccount('pilot');
		await provision.prepareFoundationAccount('second');
		const session = await auth.createSession('pilot');
		// Only this isolated fixture activates synthetic accounts. No operator endpoint is shipped.
		await db.exec(`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1`);
		function event(path, signed = session.cookie) {
			return {
				locals: {},
				route: { id: null },
				url: new URL('http://localhost:5173' + path),
				request: new Request('http://localhost:5173' + path),
				cookies: { get: (name) => (name === 'rsid_dev' ? signed : 'forged-space') }
			};
		}
		async function throughHook(path, callback, signed) {
			let result;
			await hooks.handle({
				event: event(path, signed),
				resolve: async (e) => {
					result = await callback(e);
					return new Response('ok');
				}
			});
			return result;
		}
		await t.test('Relish blocks Brokerage before authentication and strips navigation even for owners', async () => {
			const previous = process.env.RELISH_BROKERAGE_ENABLED;
			delete process.env.RELISH_BROKERAGE_ENABLED;
			try {
				// SvelteKit has already matched the unescaped route ID before calling the hook.
				const blocked = event('/%64eals/fixture', '');
				blocked.route.id = '/deals/[id]';
				blocked.cookies.get = () => { throw new Error('Unexpected session read'); };
				await assert.rejects(hooks.handle({ event: blocked, resolve: () => assert.fail('unexpected handler') }),
					error => error.status === 404);

				await db.query(`UPDATE "User" SET role='owner' WHERE id='pilot'`);
				try {
					const capabilities = () => throughHook('/people', async e => (await layout.load(e)).capabilities);
					assert.deepEqual(await capabilities(), ['MEMBER', 'OPERATOR', 'ADMIN']);
					await assert.rejects(throughHook('/broker', () => assert.fail('unexpected handler')),
						error => error.status === 404);
					process.env.RELISH_BROKERAGE_ENABLED = 'YES';
					assert.deepEqual(await capabilities(), ['MEMBER', 'OPERATOR', 'ADMIN']);
					await assert.rejects(throughHook('/broker', () => assert.fail('retired route')), error => error.status === 404);
					await assert.rejects(throughHook('/tasks', () => assert.fail('retired route')), error => error.status === 404);
				} finally {
					await db.query(`UPDATE "User" SET role='member' WHERE id='pilot'`);
				}
			} finally {
				if (previous === undefined) delete process.env.RELISH_BROKERAGE_ENABLED;
				else process.env.RELISH_BROKERAGE_ENABLED = previous;
			}
		});

		const directoryFor = (who = locals, q = '', after) =>
			directory.load({
				locals: who,
				url: new URL(
					'http://localhost/people?' + new URLSearchParams({ q, ...(after ? { after } : {}) })
				)
			});
		async function create(who, values) {
			const request = new Request('http://localhost/people/new', {
				method: 'POST',
				body: new URLSearchParams(values)
			});
			try {
				return await add.actions.default({ locals: who, request });
			} catch (e) {
				if (e.status === 303 && e.location.startsWith('/people/'))
					return e.location.split('/').pop();
				throw e;
			}
		}
		let id;
		await t.test(
			'authenticated hook selects the foundation directory with no legacy custody or self entry',
			async () => {
				const result = await throughHook('/people?owner=second&context=forged', async (e) => {
					assert.equal(e.locals.user.id, 'pilot');
					assert.equal(e.locals.contextSpaceId, undefined);
					assert.equal((await layout.load(e)).activeContext, null);
					return directory.load(e);
				});
				assert.equal(result.foundation, true);
				assert.deepEqual(result.people, []);
			}
		);
		await t.test(
			'manual create, reopen and search use encrypted owner details without linking or merging',
			async () => {
				id = await create(locals, {
					name: ' Betty ',
					email: 'betty@example.test',
					phone: '0412 345 678',
					ownerUserId: 'second',
					vaultId: 'foreign',
					context: 'business'
				});
				assert.match(id, /^[0-9a-f-]{36}$/);
				const sameName = await create(locals, { name: 'Betty', email: 'betty@example.test' });
				assert.notEqual(id, sameName);
				const result = await throughHook('/people/' + id, (e) =>
					detail.load({ ...e, params: { id } })
				);
				assert.equal(result.contact.name, 'Betty');
				assert.equal(result.contact.email, 'betty@example.test');
				assert.equal(result.contact.phone, '0412 345 678');
				assert.equal(result.foundation, true);
				assert.equal((await directoryFor(locals, 'BETTY')).people.length, 2);
				assert.equal((await directoryFor(locals, 'example.test')).people.length, 2);
				assert.deepEqual(
					(await directoryFor(locals, '0412')).people.map((p) => p.id),
					[id]
				);
				const row = (await db.query('SELECT * FROM "FoundationSubject" WHERE id=$1', [id])).rows[0];
				assert.equal(row.ownerUserId, 'pilot');
				assert.equal(row.selfUserId, null);
				assert.ok(!row.displayNameEnc.includes('Betty'));
				assert.ok(!row.detailsEnc.includes('example.test'));
				assert.throws(() =>
					crypto.decrypt(
						row.detailsEnc,
						`foundation:v1:FoundationSubject:detailsEnc:second:${root.vaultId}:${id}`
					)
				);
				const counts = await db.query(
					'SELECT (SELECT count(*) FROM "Contact")::int AS contacts, (SELECT count(*) FROM "Person")::int AS people'
				);
				assert.deepEqual(counts.rows[0], { contacts: 0, people: 0 });
			}
		);
		await t.test(
			'foreign, missing, self, relationship and archived IDs reveal no person details',
			async () => {
				await assert.rejects(
					detail.load({ locals: second, params: { id } }),
					(e) => e.status === 404
				);
				assert.deepEqual((await directoryFor(second, 'Betty')).people, []);
				await assert.rejects(
					detail.load({ locals, params: { id: '00000000-0000-0000-0000-000000000000' } }),
					(e) => e.status === 404
				);
				await assert.rejects(
					detail.load({ locals, params: { id: root.selfSubjectId } }),
					(e) => e.status === 404
				);
				const write = await policy.resolveFoundationAccess(locals, 'WRITE');
				const relation = await people.createRelationship(write, 'Private relationship', [
					root.selfSubjectId,
					id
				]);
				await assert.rejects(
					detail.load({ locals, params: { id: relation.id } }),
					(e) => e.status === 404
				);
				const archived = await people.createPerson(write, 'Archived');
				await people.archiveSubject(write, archived.id);
				await assert.rejects(
					detail.load({ locals, params: { id: archived.id } }),
					(e) => e.status === 404
				);
				assert.deepEqual((await directoryFor(locals, 'Archived')).people, []);
			}
		);
		await t.test('invalid submissions and anonymous requests never persist people', async () => {
			const before = (await directoryFor()).people.length;
			for (const values of [
				{ name: '' },
				{ name: 'Betty', email: 'bad' },
				{ name: 'Betty', phone: 'javascript:123' }
			]) {
				const failed = await create(locals, values);
				assert.equal(failed.status, 400);
				assert.ok(failed.data.error);
			}
			await assert.rejects(
				directoryFor({}),
				(e) => e.status === 303 && e.location === '/auth/login'
			);
			await assert.rejects(create({}, { name: 'Anonymous' }), (e) => e.status === 303);
			await assert.rejects(detail.load({ locals: {}, params: { id } }), (e) => e.status === 303);
			await assert.rejects(directoryFor(locals, '', 'invalid'), (e) => e.status === 400);
			assert.equal((await directoryFor()).people.length, before);
		});
		await t.test(
			'bounded search continues beyond empty pages and excludes another owner',
			async () => {
				const write = await policy.resolveFoundationAccess(locals, 'WRITE');
				for (let i = 0; i < 52; i++) await people.createPerson(write, 'Page person ' + i);
				const first = await directoryFor();
				assert.equal(first.people.length, 50);
				assert.ok(first.next);
				const last = await directoryFor(locals, '', first.next);
				assert.equal(last.people.length, 4);
				assert.equal(last.next, null);
				assert.equal(new Set([...first.people, ...last.people].map((p) => p.id)).size, 54);
				const query = last.people[0].name;
				let page = await directoryFor(locals, query),
					found = [...page.people];
				while (page.next) {
					page = await directoryFor(locals, query, page.next);
					found.push(...page.people);
				}
				assert.ok(found.some((p) => p.id === last.people[0].id));
				assert.deepEqual((await directoryFor(second, query, first.next)).people, []);
				const emptyPage = await directoryFor(locals, 'absent person');
				assert.equal(emptyPage.people.length, 0);
				assert.ok(emptyPage.next);
			}
		);
		await t.test(
			'unsupported diagnostics remain closed and suspension or a locked vault never falls back to Contacts',
			async () => {
				for (const path of [
					'/people/api/transcription-diagnostics'
				]) {
					await assert.rejects(
						throughHook(path, () => assert.fail('route reached')),
						(e) => e.status === 503
					);
				}
				await db.exec(`UPDATE "FoundationVault" SET state='LOCKED' WHERE "ownerUserId"='pilot'`);
				await assert.rejects(directoryFor(), (e) => e.status === 404);
				await assert.rejects(create(locals, { name: 'Blocked' }), (e) => e.status === 404);
				await db.exec(
					`UPDATE "FoundationVault" SET state='ACTIVE' WHERE "ownerUserId"='pilot'; UPDATE "FoundationEnrollment" SET state='SUSPENDED',epoch=epoch+1 WHERE "userId"='pilot'`
				);
				await assert.rejects(directoryFor(), (e) => e.status === 503);
				await assert.rejects(create(locals, { name: 'Blocked' }), (e) => e.status === 503);
				await assert.rejects(
					throughHook('/people', () => assert.fail('route reached')),
					(e) => e.status === 503
				);
				const rows = await db.query('SELECT count(*)::int AS n FROM "Contact" WHERE "userId"=$1', [
					'pilot'
				]);
				assert.equal(rows.rows[0].n, 0);
			}
		);
		await t.test(
			'LEGACY and PREPARED sessions still create and open the original private Contact path',
			async () => {
				const legacySession = await auth.createSession('legacy');
				async function legacyCreate() {
					return throughHook(
						'/people/new',
						(e) => create(e.locals, { name: 'Legacy person' }),
						legacySession.cookie
					);
				}
				const legacyId = await legacyCreate();
				const opened = await throughHook(
					'/people/' + legacyId,
					(e) => detail.load({ ...e, params: { id: legacyId } }),
					legacySession.cookie
				);
				assert.equal(opened.foundation, false);
				assert.equal(opened.contact.name, 'Legacy person');
				await provision.prepareFoundationAccount('legacy');
				await legacyCreate();
				const listed = await throughHook('/people', (e) => directory.load(e), legacySession.cookie);
				assert.equal(listed.foundation, false);
				assert.equal(listed.people.length, 2);
			}
		);

		await t.test(
			'rendered directory explains partial search and details expose the guarded note action',
			async () => {
				const out = resolve('.svelte-kit/p301-render');
				await mkdir(out, { recursive: true });
				async function screen(source, name, data) {
					const built = compile(await readFile(source, 'utf8'), { generate: 'server' });
					await writeFile(out + '/' + name + '.mjs', built.js.code);
					const Component = (await import(out + '/' + name + '.mjs')).default;
					return render(Component, { props: { data } }).body;
				}
				const listing = await screen('src/routes/people/+page.svelte', 'directory', {
					foundation: true,
					people: [],
					q: 'A&B',
					next: id
				});
				assert.match(listing, /Continue searching/);
				assert.match(listing, /No matches on this page/);
				assert.match(listing, /q=A%26B/);
				const data = {
					foundation: true,
					contact: { id, name: '<script>Betty</script>', email: 'betty@example.test', phone: '' },
					origin: null,
					notes: []
				};
				const person = await screen('src/routes/people/[id]/+page.svelte', 'detail', data);
				assert.match(person, /&lt;script(?:>|&gt;)Betty/);
				assert.match(person, /notes\/new/);
				const old = await screen('src/routes/people/[id]/+page.svelte', 'legacy-detail', {
					...data,
					foundation: false
				});
				assert.match(old, /notes\/new/);
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
