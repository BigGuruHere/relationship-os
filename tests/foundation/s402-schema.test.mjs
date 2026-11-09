// Exercise the additive migration only on an embedded, disposable PostgreSQL database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { createServer } from 'vite';
import { legacySchemaFixture } from './legacy-schema-fixture.mjs';

test('S-402a exchange persistence', { timeout: 120000 }, async (t) => {
	const db = await PGlite.create({ extensions: { vector } });
	let vite;
	try {
		const fixture = await legacySchemaFixture(
			(await readFile('prisma/schema.prisma', 'utf8')).replace(
				// This unique index is introduced by S-402a after the legacy baseline.
				/^\s*@@unique\(\[id, userId\], map: "s402_profile_scope"\)\s*$/m,
				''
			)
		);
		await db.exec('CREATE EXTENSION vector');
		await db.exec(fixture.legacySql);
		await db.exec(
			await readFile(
				'prisma/migrations/20261104010000_f202_foundation_schema/migration.sql',
				'utf8'
			)
		);
		await db.exec(`INSERT INTO "User"(id,"updatedAt") VALUES ('a',now()),('b',now()),('c',now());
INSERT INTO "Profile"(id,"userId",slug,"updatedAt") VALUES ('profile-a','a','a',now()),('profile-b','b','b',now());
INSERT INTO "FoundationVault"(id,"ownerUserId","updatedAt") VALUES ('va','a',now()),('vb','b',now());
INSERT INTO "FoundationSubject"(id,"ownerUserId","vaultId",kind,"displayNameEnc","updatedAt") VALUES
('pa','a','va','PERSON','synthetic',now()),('pb','b','vb','PERSON','synthetic',now()),('ra','a','va','RELATIONSHIP','synthetic',now());
INSERT INTO "FoundationSource"(id,"ownerUserId","vaultId",kind,"ingestKey","updatedAt") VALUES
('sa','a','va','CONTACT_EXCHANGE','a',now()),('sb','b','vb','CONTACT_EXCHANGE','b',now()),('note','a','va','OWNER_NOTE','note',now());`);
		const tables = (
			await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
		).rows;
		const snapshot = async () =>
			Object.fromEntries(
				await Promise.all(
					tables.map(async ({ tablename }) => [
						tablename,
						(
							await db.query(
								`SELECT to_jsonb(t) AS row FROM "${tablename}" t ORDER BY to_jsonb(t)::text`
							)
						).rows
					])
				)
			);
		const before = await snapshot();
		const migration = await readFile(
			'prisma/migrations/20261107010000_s402_exchange_claims/migration.sql',
			'utf8'
		);
		await db.exec(migration);
		await t.test('migration preserves every pre-existing row', async () =>
			assert.deepEqual(await snapshot(), before)
		);
		const insert = async (table, data) => {
			const keys = Object.keys(data);
			return db.query(
				`INSERT INTO "${table}" (${keys.map((k) => '"' + k + '"').join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
				Object.values(data)
			);
		};
		const now = new Date();
		const expires = new Date(now.getTime() + 900000);
		const exchange = {
			id: 'e',
			ownerUserId: 'a',
			vaultId: 'va',
			profileId: 'profile-a',
			subjectId: 'pa',
			sourceId: 'sa',
			snapshotEnc: 'synthetic',
			continuationHash: 'a'.repeat(64),
			beneficiaryUserId: 'b',
			createdAt: now,
			expiresAt: expires,
			updatedAt: now
		};
		const reject = (fn, code = '23514') => assert.rejects(fn, (e) => e.code === code);
		await t.test('exchange binds exact owner, profile, person and capture source', async () => {
			for (const change of [
				{ vaultId: 'vb' },
				{ profileId: 'profile-b' },
				{ subjectId: 'pb' },
				{ subjectId: 'ra' },
				{ sourceId: 'sb' },
				{ sourceId: 'note' }
			])
				await reject(() => insert('FoundationExchange', { ...exchange, ...change }), '23503');
			await insert('FoundationExchange', exchange);
			await reject(
				() =>
					insert('FoundationExchange', {
						...exchange,
						id: 'duplicate',
						continuationHash: 'b'.repeat(64)
					}),
				'23505'
			);
			await reject(() =>
				db.exec(`UPDATE "FoundationExchange" SET "beneficiaryUserId"='c' WHERE id='e'`)
			);
			await reject(() =>
				db.exec(`UPDATE "FoundationExchange" SET "snapshotEnc"='changed' WHERE id='e'`)
			);
			await db.exec(`UPDATE "FoundationExchange" SET "failedAttempts"=1 WHERE id='e'`);
			await reject(() =>
				db.exec(`UPDATE "FoundationExchange" SET "failedAttempts"=0 WHERE id='e'`)
			);
		});
		const challenge = {
			id: 'ch',
			ownerUserId: 'a',
			vaultId: 'va',
			exchangeId: 'e',
			beneficiaryUserId: 'b',
			sessionHash: 'c'.repeat(64),
			channel: 'SMS',
			destinationEnc: 'synthetic',
			codeMac: 'd'.repeat(64),
			generation: 1,
			createdAt: now,
			expiresAt: expires
		};
		await t.test(
			'challenge rejects account substitution, invalid state and resend reuse',
			async () => {
				await reject(
					() => insert('FoundationExchangeChallenge', { ...challenge, beneficiaryUserId: 'c' }),
					'23503'
				);
				await reject(() =>
					insert('FoundationExchangeChallenge', { ...challenge, channel: 'CALLER_ID' })
				);
				await reject(() =>
					insert('FoundationExchangeChallenge', { ...challenge, status: 'VERIFIED' })
				);
				await insert('FoundationExchangeChallenge', challenge);
				await reject(
					() => insert('FoundationExchangeChallenge', { ...challenge, id: 'ch2' }),
					'23505'
				);
				await reject(() =>
					db.exec(
						`UPDATE "FoundationExchangeChallenge" SET "sessionHash"=repeat('e',64) WHERE id='ch'`
					)
				);
				await db.exec(`UPDATE "FoundationExchangeChallenge" SET attempts=1 WHERE id='ch'`);
				await reject(() =>
					db.exec(`UPDATE "FoundationExchangeChallenge" SET attempts=0 WHERE id='ch'`)
				);
				await reject(() =>
					db.exec(`UPDATE "FoundationExchangeChallenge" SET attempts=6 WHERE id='ch'`)
				);
				await insert('FoundationExchangeChallenge', {
					...challenge,
					id: 'email',
					generation: 2,
					channel: 'EMAIL'
				});
			}
		);
		const dispatch = {
			id: 'd',
			ownerUserId: 'a',
			vaultId: 'va',
			challengeId: 'ch',
			payloadEnc: 'synthetic',
			createdAt: now,
			expiresAt: expires,
			updatedAt: now
		};
		await t.test(
			'delivery custody, leases, metadata and terminal payload removal are enforced',
			async () => {
				await reject(
					() =>
						insert('FoundationExchangeDispatch', { ...dispatch, ownerUserId: 'b', vaultId: 'vb' }),
					'23503'
				);
				await insert('FoundationExchangeDispatch', dispatch);
				await reject(() =>
					db.exec(`UPDATE "FoundationExchangeDispatch" SET status='SENDING' WHERE id='d'`)
				);
				await reject(() =>
					db.exec(
						`UPDATE "FoundationExchangeDispatch" SET "lastErrorCode"='raw sensitive provider response' WHERE id='d'`
					)
				);
				await reject(() =>
					db.exec(`UPDATE "FoundationExchangeDispatch" SET status='SENT' WHERE id='d'`)
				);
				await db.exec(
					`UPDATE "FoundationExchangeDispatch" SET status='SENT',"payloadEnc"=NULL WHERE id='d'`
				);
				await reject(() =>
					db.exec(
						`UPDATE "FoundationExchangeDispatch" SET status='QUEUED',"payloadEnc"='synthetic' WHERE id='d'`
					)
				);
				await reject(() => db.exec(`DELETE FROM "FoundationExchange" WHERE id='e'`), '23001');
			}
		);
		await t.test('ordinary application capabilities deny exchange models', async () => {
			vite = await createServer({
				configFile: false,
				server: { middlewareMode: true, hmr: false },
				resolve: { alias: { $lib: resolve('src/lib') } }
			});
			const { guardFoundationQuery, runFoundationBoundary } = await vite.ssrLoadModule(
				'/src/lib/server/foundation/internal.ts'
			);
			for (const model of [
				'FoundationExchange',
				'FoundationExchangeChallenge',
				'FoundationExchangeDispatch',
				'FoundationAccountAssociation',
				'FoundationClaimBudget'
			]) {
				assert.throws(() => guardFoundationQuery(model, 'findMany', {}), /unavailable/);
				for (const mode of ['RESOLVE', 'PROVISION', 'PUBLIC_CAPTURE', 'READ', 'WRITE'])
					await assert.rejects(
						runFoundationBoundary({ ownerUserId: 'a', vaultId: 'va', mode }, async () =>
							guardFoundationQuery(model, 'findMany', {})
						),
						/unavailable/
					);
			}
		});
		await t.test('failed migration rolls back all additions', async () => {
			// Run on an independent empty copy to prove BEGIN/COMMIT wraps the whole migration.
			const fresh = await PGlite.create({ extensions: { vector } });
			try {
				await fresh.exec('CREATE EXTENSION vector');
				await fresh.exec(fixture.legacySql);
				await fresh.exec(
					await readFile(
						'prisma/migrations/20261104010000_f202_foundation_schema/migration.sql',
						'utf8'
					)
				);
				await assert.rejects(fresh.exec(migration.replace(/COMMIT;\s*$/, 'SELECT 1/0; COMMIT;')));
				await fresh.exec('ROLLBACK');
				assert.equal(
					(
						await fresh.query(
							`SELECT count(*)::int n FROM pg_tables WHERE tablename LIKE 'FoundationExchange%'`
						)
					).rows[0].n,
					0
				);
			} finally {
				await fresh.close();
			}
		});
	} finally {
		if (vite) await vite.close();
		await db.close();
	}
});
