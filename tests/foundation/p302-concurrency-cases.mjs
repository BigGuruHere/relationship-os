// Standard PostgreSQL races use the existing isolated F-204 fixture database, never a target database.
import test from 'node:test';
import assert from 'node:assert/strict';
export async function exerciseCaptureConcurrency({ vite, db, endpoint }) {
	const load = (path) => vite.ssrLoadModule('/src/lib/server/' + path + '.ts');
	const provision = await load('foundation/provisioning');
	const capture = await load('foundation/capture');
	const tokens = await load('core/contactCaptureToken');
	process.env.SESSION_COOKIE_SECRET = 'p302-synthetic-concurrency-secret';
	const input = () => ({
		name: 'Visitor',
		browser: 'synthetic-browser',
		captureToken: tokens.issueContactCaptureToken('race-card', 'synthetic-browser', 'qr')
	});
	await test(
		'P-302 overlapping duplicate receipts commit once and conflicting retries cannot overwrite',
		{ skip: !endpoint },
		async () => {
			// Minimal public profile fixture is sufficient for the actual repository's fixed projection.
			await db.exec(`CREATE TABLE "Profile" (id text PRIMARY KEY, "userId" text NOT NULL, kind text NOT NULL DEFAULT 'business', "isPublished" boolean NOT NULL DEFAULT true);
      INSERT INTO "User" VALUES ('intake-race');
      INSERT INTO "Profile" (id,"userId") VALUES ('race-card','intake-race')`);
			await provision.prepareFoundationAccount('intake-race');
			await db.exec(
				`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1 WHERE "userId"='intake-race'`
			);
			const value = input();
			await Promise.all(
				Array.from({ length: 5 }, () => capture.captureFoundationContact('race-card', value))
			);
			const count = async () =>
				(
					await db.observer.query(
						`SELECT count(*)::int n FROM "FoundationSource" WHERE "ownerUserId"='intake-race'`
					)
				).rows[0].n;
			assert.equal(await count(), 1);
			const another = input();
			const outcomes = await Promise.allSettled(
				['One', 'Two'].map((name) =>
					capture.captureFoundationContact('race-card', { ...another, name })
				)
			);
			assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
			assert.equal(outcomes.find((r) => r.status === 'rejected').reason.status, 409);
			assert.equal(await count(), 2);
			// Fill to 99 using synthetic receipts, then race the final two slots across real connections.
			const source = (
				await db.observer.query(
					`SELECT "vaultId", "ingestKey" FROM "FoundationSource" WHERE "ownerUserId"='intake-race' LIMIT 1`
				)
			).rows[0];
			const prefix = source.ingestKey.slice(0, source.ingestKey.lastIndexOf(':') + 1);
			await db.observer.query(
				`INSERT INTO "FoundationSource" (id,"ownerUserId","vaultId",kind,"ingestKey","updatedAt") SELECT 'rate-fixture-'||n,'intake-race',$1,'CONTACT_EXCHANGE',$2||'fixture-'||n,now() FROM generate_series(1,97) n`,
				[source.vaultId, prefix]
			);
			const capped = await Promise.allSettled(
				[input(), input()].map((value) => capture.captureFoundationContact('race-card', value))
			);
			assert.equal(capped.filter((r) => r.status === 'fulfilled').length, 1);
			assert.equal(capped.find((r) => r.status === 'rejected').reason.status, 429);
			assert.equal(await count(), 100);
		}
	);
	await test(
		'P-302 waiting capture rechecks committed suspension and profile withdrawal',
		{ skip: !endpoint },
		async () => {
			const { Client } = await import('pg');
			for (const operation of ['suspend', 'withdraw']) {
				const locker = new Client({ connectionString: endpoint });
				await locker.connect();
				let outcome;
				try {
					await locker.query('BEGIN');
					if (operation === 'suspend') {
						await locker.query(
							"SELECT pg_advisory_xact_lock(hashtextextended('foundation:account:intake-race',0))"
						);
						await locker.query(
							`UPDATE "FoundationEnrollment" SET state='SUSPENDED',epoch=epoch+1 WHERE "userId"='intake-race'`
						);
					} else {
						await locker.query(`UPDATE "Profile" SET "isPublished"=false WHERE id='race-card'`);
					}
					outcome = capture.captureFoundationContact('race-card', input()).then(
						() => 'unexpected write',
						(e) => e.status
					);
					const deadline = Date.now() + 4000;
					let blocked = false;
					while (Date.now() < deadline) {
						const r = await db.observer.query(
							'SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS blocked',
							[locker.processID]
						);
						if (r.rows[0].blocked) {
							blocked = true;
							break;
						}
						await new Promise((resolve) => setTimeout(resolve, 20));
					}
					assert.equal(blocked, true);
					await locker.query('COMMIT');
					assert.equal(await outcome, operation === 'suspend' ? 503 : 404);
				} finally {
					await locker.query('ROLLBACK');
					await locker.end();
					if (outcome) await outcome;
				}
				await db.exec(
					`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1 WHERE "userId"='intake-race'`
				);
			}
			assert.equal(
				(
					await db.observer.query(
						`SELECT count(*)::int n FROM "FoundationSource" WHERE "ownerUserId"='intake-race'`
					)
				).rows[0].n,
				100
			);
		}
	);
}
