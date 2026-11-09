// Rehearse the exact operator SQL on the existing disposable P-306 database.
// No external DATABASE_URL, Neon credentials or provider calls are used here.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function accountResetCases(t, db, afterReset) {
  const template = await readFile('scripts/maintenance/reset-test-accounts.sql', 'utf8');
  const inspect = await readFile('scripts/maintenance/inspect-test-reset.sql', 'utf8');
  // This fixture was assembled from the current schema plus production SQL invariants.
  await db.exec(`CREATE TABLE public._prisma_migrations (id text PRIMARY KEY, migration_name text,
    finished_at timestamp, rolled_back_at timestamp);
    INSERT INTO public._prisma_migrations VALUES ('fixture','fixture-baseline',now(),NULL);`);
  const before = await db.query(`SELECT count(*)::int AS n,
    md5(coalesce(string_agg(id || ':' || "createdAt"::text, ',' ORDER BY id), '')) AS fingerprint FROM "User"`);
  const { n, fingerprint } = before.rows[0];
  const database = (await db.query('SELECT current_database() AS name')).rows[0].name;
  const prepared = template.replace('REPLACE_DATABASE_NAME', database)
    .replace("'REPLACE_ACCOUNT_FINGERPRINT'", `'${fingerprint}'`)
    .replace("'REPLACE_CONFIRMATION'", "'ERASE ALL DISPOSABLE RELISH DATA'")
    .replace("', 18, '", `', ${n}, '`);
  const committing = prepared.replace(/ROLLBACK;\s*$/, 'COMMIT;');
  const rows = async () => (await db.query('SELECT * FROM public."User" ORDER BY id')).rows;
  const originalRows = await rows();
  const migrations = await db.query('SELECT * FROM public._prisma_migrations');
  async function refused(sql, expected) {
    await assert.rejects(db.exec(sql), expected);
    await db.exec('ROLLBACK');
    assert.deepEqual(await rows(), originalRows);
  }
  await t.test('reset inventory is read-only and reset defaults reject missing confirmation', async () => {
    await db.exec(inspect);
    assert.deepEqual(await rows(), originalRows);
    await refused(template, /not confirmed/);
  });
  await t.test('wrong database, stale account set and unfinished migrations fail closed', async () => {
    await refused(committing.replace(`'${database}'`, "'different-database'"), /not confirmed/);
    await refused(committing.replace(fingerprint, '0'.repeat(32)), /Accounts changed/);
    await db.exec(`INSERT INTO public._prisma_migrations VALUES ('unfinished','unfinished',NULL,NULL)`);
    await refused(committing, /unfinished migration/);
    await db.exec(`DELETE FROM public._prisma_migrations WHERE id='unfinished'`);
  });
  await t.test('unknown tables and foreign keys outside the reviewed schema cannot be cascaded', async () => {
    await db.exec('CREATE TABLE public."Unreviewed" (id text)');
    await refused(committing, /table inventory changed/);
    await db.exec('DROP TABLE public."Unreviewed"; CREATE SCHEMA outside_reset; CREATE TABLE outside_reset.reference (id text REFERENCES public."User"(id))');
    await refused(committing, /foreign key constraint/);
    await db.exec('DROP SCHEMA outside_reset CASCADE');
  });
  await t.test('a database failure during truncate rolls back the complete reset', async () => {
    await db.exec(`CREATE FUNCTION public.reject_reset_fixture() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN RAISE EXCEPTION 'synthetic reset failure'; END $$;
      CREATE TRIGGER reject_reset_fixture BEFORE TRUNCATE ON public."User"
      FOR EACH STATEMENT EXECUTE FUNCTION public.reject_reset_fixture()`);
    await refused(committing, /synthetic reset failure/);
    await db.exec('DROP TRIGGER reject_reset_fixture ON public."User"; DROP FUNCTION public.reject_reset_fixture()');
  });
  await t.test('rehearsal removes every application row temporarily and restores it on rollback', async () => {
    const result = await db.exec(prepared);
    const inventory = result.find(r => r.fields?.some(f => f.name === 'after_rows')).rows;
    assert.equal(inventory.length, 128);
    assert.ok(inventory.every(row => Number(row.after_rows) === 0));
    assert.deepEqual(await rows(), originalRows);
    assert.deepEqual(await db.query('SELECT * FROM public._prisma_migrations'), migrations);
  });
  await t.test('committed reset empties every application table and preserves migration history', async () => {
    await db.exec(committing);
    assert.deepEqual(await rows(), []);
    assert.deepEqual(await db.query('SELECT * FROM public._prisma_migrations'), migrations);
  });
  await afterReset();
}
