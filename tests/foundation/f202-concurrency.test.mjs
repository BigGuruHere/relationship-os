// Uses only an explicitly named empty disposable loopback database, never DATABASE_URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const endpoint = new URL(process.env.F202_TEST_DATABASE_URL || 'invalid:');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
assert.match(endpoint.pathname, /^\/relish_f202_[a-z0-9_]+$/);
const clients = [];
const scope = { ownerUserId: 'race-owner', vaultId: 'race-vault' };

async function connect() {
  const client = new Client({ connectionString: endpoint.href });
  await client.connect();
  clients.push(client);
  await client.query("SET statement_timeout = '10s'; SET lock_timeout = '8s'");
  return client;
}

// Table and column names below are fixed test fixtures; all values are parameterized.
async function insert(client, table, data) {
  const keys = Object.keys(data);
  await client.query('INSERT INTO "' + table + '" (' +
    keys.map(k => '"' + k + '"').join(',') + ') VALUES (' +
    keys.map((_, i) => '$' + (i + 1)).join(',') + ')', Object.values(data));
}
async function tx(client, fn) {
  await client.query('BEGIN');
  try { await fn(); await client.query('COMMIT'); }
  catch (error) { await client.query('ROLLBACK'); throw error; }
}
async function statement(client, id) {
  await insert(client, 'FoundationStatement', { id, ...scope, perspectiveId: 'race-perspective', updatedAt: new Date() });
  await insert(client, 'FoundationStatementVersion', { id: id + '-v1', ...scope, statementId: id,
    version: 1, textEnc: 'synthetic', mode: 'OBSERVED', confidence: 'MEDIUM', provenanceEnc: 'synthetic' });
  await insert(client, 'FoundationStatementSubject', { id: id + '-subject', ...scope,
    statementVersionId: id + '-v1', subjectId: 'race-person' });
  await insert(client, 'FoundationSupport', { id: id + '-support', ...scope,
    outputVersionId: id + '-v1', segmentId: 'race-segment1', relation: 'SUPPORTS' });
}

// Prove actual overlapping database transactions, rather than relying on a timing guess.
async function blocked(observer, waiter, blocker) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = await observer.query('SELECT $2::int = ANY(pg_blocking_pids($1::int)) AS blocked',
      [waiter.processID, blocker.processID]);
    if (result.rows[0].blocked) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Expected second writer to block on first writer');
}
async function race(a, b, observer, isolation, first, second, expected, retryCode) {
  let pending;
  try {
    await a.query('BEGIN ISOLATION LEVEL ' + isolation);
    await b.query('BEGIN ISOLATION LEVEL ' + isolation);
    // Establish both snapshots before the first writer changes the vault.
    await a.query('SELECT count(*) FROM "FoundationVault"');
    await b.query('SELECT count(*) FROM "FoundationVault"');
    await first(a);
    pending = (async () => {
      try { await second(b); await b.query('COMMIT'); return 'COMMITTED'; }
      catch (error) { await b.query('ROLLBACK'); return error.code; }
    })();
    await blocked(observer, b, a);
    await a.query('COMMIT');
    assert.equal(await pending, expected);
    // A serialization retry must reevaluate and reject the now-invalid graph operation.
    if (retryCode) await assert.rejects(tx(b, () => second(b)), error => error.code === retryCode);
  } finally {
    await a.query('ROLLBACK');
    if (pending) await pending;
    await b.query('ROLLBACK');
  }
}

test('F-202 standard PostgreSQL concurrent writers', { timeout: 120000 }, async t => {
  try {
    const admin = await connect();
    const info = await admin.query('SELECT current_database() AS db, version() AS version');
    assert.equal(info.rows[0].db, endpoint.pathname.slice(1));
    t.diagnostic(info.rows[0].version);
    const tables = await admin.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'");
    assert.equal(tables.rows[0].count, 0, 'Refuse to modify a nonempty database');
    // The complete legacy fixture is tested separately by f202-schema.test.mjs.
    await admin.query('CREATE TABLE "User" (id text PRIMARY KEY)');
    await admin.query(await readFile(new URL('../../prisma/migrations/20261104010000_f202_foundation_schema/migration.sql', import.meta.url), 'utf8'));
    await insert(admin, 'User', { id: scope.ownerUserId });
    await insert(admin, 'FoundationVault', { id: scope.vaultId, ownerUserId: scope.ownerUserId, updatedAt: new Date() });
    await insert(admin, 'FoundationSubject', { id: 'race-person', ...scope, kind: 'PERSON', displayNameEnc: 'synthetic', updatedAt: new Date() });
    await insert(admin, 'FoundationPerspective', { id: 'race-perspective', ...scope, kind: 'OWNER_RECORDED' });
    await insert(admin, 'FoundationSource', { id: 'race-source', ...scope, kind: 'OWNER_NOTE', ingestKey: 'synthetic', updatedAt: new Date() });
    const versionData = { ...scope, version: 1, payloadEnc: 'synthetic', contentMac: 'synthetic',
      recordedByKind: 'OWNER', provenanceEnc: 'synthetic' };
    await insert(admin, 'FoundationSourceVersion', { ...versionData, id: 'race-source-v1', sourceId: 'race-source' });
    for (const i of [1, 2]) await insert(admin, 'FoundationEvidenceSegment', { id: 'race-segment' + i, ...scope,
      sourceVersionId: 'race-source-v1', anchorEnc: 'synthetic', excerptEnc: 'synthetic', anchorMac: 'anchor' + i });
    const a = await connect();
    const b = await connect();
    assert.notEqual(a.processID, b.processID);

    for (const isolation of ['READ COMMITTED', 'REPEATABLE READ']) {
      const repeatable = isolation === 'REPEATABLE READ';
      for (let iteration = 0; iteration < 3; iteration++) {
        const prefix = (repeatable ? 'rr' : 'rc') + iteration;
        const graphCode = repeatable ? '40001' : '23514';
        const retryCode = repeatable ? '23514' : undefined;
        await t.test(prefix + ': opposite edges cannot form a cycle', async () => {
          await tx(admin, async () => { await statement(admin, prefix + '-a'); await statement(admin, prefix + '-b'); });
          const edge = (client, suffix, output, input) => insert(client, 'FoundationSupport', {
            id: prefix + suffix, ...scope, outputVersionId: prefix + output + '-v1',
            inputVersionId: prefix + input + '-v1', relation: 'QUALIFIES' });
          await race(a, b, admin, isolation, c => edge(c, '-ab', '-a', '-b'),
            c => edge(c, '-ba', '-b', '-a'), graphCode, retryCode);
          const result = await admin.query('SELECT count(*)::int AS count FROM "FoundationSupport" WHERE id = ANY($1::text[])',
            [[prefix + '-ab', prefix + '-ba']]);
          assert.equal(result.rows[0].count, 1);
        });
        await t.test(prefix + ': concurrent removals retain support', async () => {
          const id = prefix + '-remove';
          await tx(admin, async () => {
            await statement(admin, id);
            await insert(admin, 'FoundationSupport', { id: id + '-support2', ...scope,
              outputVersionId: id + '-v1', segmentId: 'race-segment2', relation: 'SUPPORTS' });
          });
          await race(a, b, admin, isolation,
            c => c.query('DELETE FROM "FoundationSupport" WHERE id = $1', [id + '-support']),
            c => c.query('DELETE FROM "FoundationSupport" WHERE id = $1', [id + '-support2']), graphCode, retryCode);
          const result = await admin.query('SELECT count(*)::int AS count FROM "FoundationSupport" WHERE "outputVersionId" = $1', [id + '-v1']);
          assert.equal(result.rows[0].count, 1);
        });
        await t.test(prefix + ': competing version appends have one winner', async () => {
          const id = prefix + '-source';
          await insert(admin, 'FoundationSource', { id, ...scope, kind: 'OWNER_NOTE', ingestKey: id, updatedAt: new Date() });
          await insert(admin, 'FoundationSourceVersion', { ...versionData, id: id + '-v1', sourceId: id });
          const append = (c, suffix) => insert(c, 'FoundationSourceVersion', { ...versionData,
            id: id + suffix, sourceId: id, version: 2, previousVersionId: id + '-v1', previousVersionNumber: 1 });
          await race(a, b, admin, isolation, c => append(c, '-v2a'), c => append(c, '-v2b'), '23505');
          const result = await admin.query('SELECT count(*)::int AS count FROM "FoundationSourceVersion" WHERE "sourceId" = $1 AND version = 2', [id]);
          assert.equal(result.rows[0].count, 1);
        });
        await t.test(prefix + ': duplicate ingestion keys have one winner', async () => {
          const add = (c, suffix) => insert(c, 'FoundationSource', { id: prefix + suffix, ...scope,
            kind: 'OWNER_NOTE', ingestKey: prefix + '-duplicate', updatedAt: new Date() });
          await race(a, b, admin, isolation, c => add(c, '-ingest-a'), c => add(c, '-ingest-b'), '23505');
          const result = await admin.query('SELECT count(*)::int AS count FROM "FoundationSource" WHERE "ingestKey" = $1', [prefix + '-duplicate']);
          assert.equal(result.rows[0].count, 1);
        });
      }
    }
  } finally {
    await Promise.all(clients.map(client => client.end()));
  }
});
