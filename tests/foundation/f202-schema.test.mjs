// F-202 rehearsal always uses an ephemeral embedded PostgreSQL database.
// It never reads DATABASE_URL or connects to an external database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { legacySchemaFixture } from './legacy-schema-fixture.mjs';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';

const migrationPath = 'prisma/migrations/20261104010000_f202_foundation_schema/migration.sql';
const migration = await readFile(migrationPath, 'utf8');
const schema = await readFile('prisma/schema.prisma', 'utf8');
const {legacyModels,legacySql,defaultTrigger} = await legacySchemaFixture(schema);

// All content below is synthetic. These strings are structural placeholders,
// not production encryption and not examples for an application write path.
const legacyFixture = `
INSERT INTO "Person" (id,"updatedAt") VALUES ('legacy-person',now());
INSERT INTO "User" (id,"personId","updatedAt") VALUES ('owner-a','legacy-person',now()),('owner-b',NULL,now());
INSERT INTO "ContextSpace" (id,"ownerUserId",kind,"domainKey","updatedAt") VALUES ('legacy-private','owner-a','WORKSPACE','private',now());
INSERT INTO "Contact" (id,"userId","contextSpaceId","fullNameEnc","fullNameIdx","updatedAt") VALUES
 ('legacy-business','owner-a','owner-a','synthetic','synthetic-b',now()),('legacy-private-person','owner-a','legacy-private','synthetic','synthetic-p',now());
INSERT INTO "Interaction" (id,"userId","contextSpaceId","contactId",channel,"rawTextEnc","updatedAt") VALUES
 ('legacy-note','owner-a','legacy-private','legacy-private-person','OWNER_NOTE','synthetic',now());
INSERT INTO "Profile" (id,"userId",slug,"updatedAt") VALUES ('legacy-profile','owner-a','synthetic-profile',now());
INSERT INTO "Lead" (id,"ownerId","contactId","updatedAt") VALUES ('legacy-lead','owner-a','legacy-business',now());
INSERT INTO "Relating" (id,"userId","contextSpaceId","updatedAt") VALUES ('legacy-relationship','owner-a','legacy-private',now());
INSERT INTO "RelatingParticipant" (id,"userId","contextSpaceId","relatingId","contactId") VALUES ('legacy-member','owner-a','legacy-private','legacy-relationship','legacy-private-person');
INSERT INTO "LivingUnderstandingRevision" (id,"userId","contextSpaceId","contactId","revisionNumber","adoptionKey") VALUES ('legacy-lu','owner-a','legacy-private','legacy-private-person',1,'synthetic-adoption');
`;
const foundationFixture = `
INSERT INTO "FoundationEnrollment" ("userId","updatedAt") VALUES ('owner-a',now());
INSERT INTO "FoundationVault" (id,"ownerUserId","updatedAt") VALUES ('vault-a','owner-a',now()),('vault-b','owner-b',now());
INSERT INTO "FoundationSubject" (id,"ownerUserId","vaultId",kind,"displayNameEnc","updatedAt") VALUES
 ('person-a','owner-a','vault-a','PERSON','synthetic',now()),
 ('person-a2','owner-a','vault-a','PERSON','synthetic',now()),
 ('relationship-a','owner-a','vault-a','RELATIONSHIP','synthetic',now()),
 ('person-b','owner-b','vault-b','PERSON','synthetic',now());
INSERT INTO "FoundationPerspective" (id,"ownerUserId","vaultId",kind) VALUES ('perspective-a','owner-a','vault-a','OWNER_RECORDED');
INSERT INTO "FoundationSource" (id,"ownerUserId","vaultId",kind,"ingestKey","updatedAt") VALUES ('source-a','owner-a','vault-a','OWNER_NOTE','synthetic-key',now());
INSERT INTO "FoundationSourceVersion" (id,"ownerUserId","vaultId","sourceId",version,"payloadEnc","contentMac","recordedByKind","provenanceEnc") VALUES
 ('source-v1','owner-a','vault-a','source-a',1,'synthetic','synthetic-mac','OWNER','synthetic');
INSERT INTO "FoundationEvidenceSegment" (id,"ownerUserId","vaultId","sourceVersionId","anchorEnc","excerptEnc","anchorMac") VALUES
 ('segment-a','owner-a','vault-a','source-v1','synthetic','synthetic','synthetic-anchor');
INSERT INTO "FoundationEvidenceSubject" (id,"ownerUserId","vaultId","segmentId","subjectId") VALUES
 ('es-person','owner-a','vault-a','segment-a','person-a'),('es-rel','owner-a','vault-a','segment-a','relationship-a');
`;
// Parameterised insert helper keeps test inputs separate from SQL syntax.
async function insert(db, table, values) {
  const fields = Object.keys(values);
  await db.query(`INSERT INTO "${table}" (${fields.map(f => `"${f}"`).join(',')}) VALUES (${fields.map((_,i) => `$${i+1}`).join(',')})`, Object.values(values));
}
const scope = { ownerUserId: 'owner-a', vaultId: 'vault-a' };
async function statement(db, key, input) {
  await insert(db, 'FoundationStatement', { id: key, ...scope, perspectiveId: 'perspective-a', updatedAt: new Date() });
  await insert(db, 'FoundationStatementVersion', { id: key+'-v1', ...scope, statementId: key, version: 1, textEnc: 'synthetic', mode: 'OBSERVED', confidence: 'MEDIUM', provenanceEnc: 'synthetic' });
  await insert(db, 'FoundationStatementSubject', { id: key+'-subject', ...scope, statementVersionId: key+'-v1', subjectId: 'relationship-a' });
  await insert(db, 'FoundationSupport', { id: key+'-support', ...scope, outputVersionId: key+'-v1', ...(input ? { inputVersionId: input } : { segmentId: 'segment-a' }), relation: 'SUPPORTS' });
}
async function legacySnapshot(db) {
  // Compare every legacy row, not only counts, in this isolated synthetic DB.
  const result = {};
  for (const model of legacyModels) result[model] = (await db.query(`SELECT to_jsonb(t) AS row FROM "${model}" t ORDER BY to_jsonb(t)::text`)).rows;
  return result;
}
async function rejected(db, fn, code='23514') {
  // A failed deferred COMMIT can leave the transaction open; explicitly rollback.
  await db.exec('BEGIN');
  try {
    await fn();
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    assert.ok([code].flat().includes(error.code), `${error.code}: ${error.message}`);
    return;
  }
  assert.fail('Expected database rejection');
}

test('F-202 isolated PostgreSQL schema rehearsal', { timeout: 120000 }, async t => {
  let db = await PGlite.create({ extensions: { vector } });
  let snapshot;
  try {
    await db.exec('CREATE EXTENSION vector');
    await db.exec(legacySql);
    await db.exec(defaultTrigger);
    await db.exec(legacyFixture);
    const before = await legacySnapshot(db);
    snapshot = await db.dumpDataDir();
    const started = performance.now();
    await db.exec(migration);
    t.diagnostic(`Migration applied in ${Math.round(performance.now()-started)}ms on PGlite; no external database used.`);
    await t.test('all legacy rows and the User default-space trigger survive', async () => {
      assert.deepEqual(await legacySnapshot(db), before);
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM "FoundationEnrollment"`)).rows[0].n, 0);
      await db.exec(`INSERT INTO "User" (id,"updatedAt") VALUES ('post-migration-user',now())`);
      assert.equal((await db.query(`SELECT "ownerUserId" FROM "ContextSpace" WHERE id='post-migration-user'`)).rows[0].ownerUserId, 'post-migration-user');
      await db.exec(`DELETE FROM "User" WHERE id='post-migration-user'`);
    });
    await db.exec(foundationFixture);
    await t.test('15 foundation tables exist with no legacy Person dependency', async () => {
      const names=(await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'Foundation%'`)).rows;
      assert.equal(names.length,15);
      assert.equal((await db.query(`SELECT "processingAdmission" FROM "FoundationSourceVersion"`)).rows[0].processingAdmission,'STORED_ONLY');
    });
    await t.test('cross-owner vault and subject edges are rejected', async () => {
      await rejected(db, () => insert(db,'FoundationSubject',{id:'bad-owner',...scope,vaultId:'vault-b',kind:'PERSON',displayNameEnc:'x',updatedAt:new Date()}),'23503');
      await rejected(db, () => insert(db,'FoundationEvidenceSubject',{id:'bad-edge',...scope,segmentId:'segment-a',subjectId:'person-b'}),'23503');
    });
    await t.test('relationship container and person discriminator constraints', async () => {
      await rejected(db, () => insert(db,'FoundationMembership',{id:'bad-member',...scope,containerSubjectId:'relationship-a',containerKind:'RELATIONSHIP',personSubjectId:'relationship-a',personKind:'PERSON'}),'23503');
      await rejected(db, () => insert(db,'FoundationMembership',{id:'bad-container',...scope,containerSubjectId:'person-a',containerKind:'PERSON',personSubjectId:'person-a2'}));
      await insert(db,'FoundationMembership',{id:'member',...scope,containerSubjectId:'relationship-a',containerKind:'RELATIONSHIP',personSubjectId:'person-a'});
      await rejected(db, () => insert(db,'FoundationMembership',{id:'duplicate-member',...scope,containerSubjectId:'relationship-a',containerKind:'RELATIONSHIP',personSubjectId:'person-a'}),'23505');
      await db.exec(`UPDATE "FoundationMembership" SET "leftAt"=now() WHERE id='member'`);
      await insert(db,'FoundationMembership',{id:'rejoined',...scope,containerSubjectId:'relationship-a',containerKind:'RELATIONSHIP',personSubjectId:'person-a'});
    });
    await t.test('self identity is owner-only and unique', async () => {
      await rejected(db, () => insert(db,'FoundationSubject',{id:'bad-self',...scope,kind:'PERSON',selfUserId:'owner-b',displayNameEnc:'x',updatedAt:new Date()}));
      await insert(db,'FoundationSubject',{id:'self',...scope,kind:'PERSON',selfUserId:'owner-a',displayNameEnc:'x',updatedAt:new Date()});
      await rejected(db, () => insert(db,'FoundationSubject',{id:'self2',...scope,kind:'PERSON',selfUserId:'owner-a',displayNameEnc:'x',updatedAt:new Date()}),'23505');
    });
    await t.test('nullable speaker/perspective shapes cannot bypass checks', async () => {
      await rejected(db, () => insert(db,'FoundationPerspective',{id:'bad-perspective',...scope,kind:'ATTRIBUTED_PERSON',holderSubjectId:'person-a'}));
      await rejected(db, () => insert(db,'FoundationPerspective',{id:'bad-perspective2',...scope,kind:'OWNER_RECORDED',holderSubjectId:'person-a',holderKind:'PERSON'}));
      await rejected(db, () => insert(db,'FoundationEvidenceSegment',{id:'bad-speaker',...scope,sourceVersionId:'source-v1',speakerSubjectId:'person-a',anchorEnc:'x',excerptEnc:'x',anchorMac:'bad'}));
    });
    await t.test('version lineage, immutability and duplicate correction guards', async () => {
      await rejected(db, () => db.exec(`UPDATE "FoundationSourceVersion" SET "payloadEnc"='changed' WHERE id='source-v1'`));
      await rejected(db, () => db.exec(`UPDATE "FoundationSubject" SET kind='GROUP' WHERE id='person-a2'`));
      const second={id:'source-v2',...scope,sourceId:'source-a',version:2,previousVersionId:'source-v1',previousVersionNumber:1,payloadEnc:'corrected',contentMac:'synthetic-v2',recordedByKind:'OWNER',provenanceEnc:'synthetic'};
      await rejected(db, () => insert(db,'FoundationSourceVersion',{...second,previousVersionNumber:null}));
      await insert(db,'FoundationSourceVersion',second);
      await rejected(db, () => insert(db,'FoundationSourceVersion',{...second,id:'competing-v2'}),'23505');
      assert.equal((await db.query(`SELECT "payloadEnc" FROM "FoundationSourceVersion" WHERE id='source-v1'`)).rows[0].payloadEnc,'synthetic');
      await insert(db,'FoundationSource',{id:'source-other',...scope,kind:'OWNER_NOTE',ingestKey:'other',updatedAt:new Date()});
      await rejected(db, () => insert(db,'FoundationSourceVersion',{...second,id:'wrong-parent',sourceId:'source-other'}),'23503');
    });
    await t.test('immutable evidence and perspective cannot change historical meaning', async () => {
      for (const sql of [
        `UPDATE "FoundationEvidenceSegment" SET "excerptEnc"='changed' WHERE id='segment-a'`,
        `UPDATE "FoundationPerspective" SET kind='AI_INTERPRETATION' WHERE id='perspective-a'`,
        `UPDATE "FoundationEvidenceSubject" SET "subjectId"='person-a2' WHERE id='es-person'`,
        `UPDATE "FoundationSource" SET "ingestKey"='changed' WHERE id='source-a'`,
        `UPDATE "FoundationVault" SET "ownerUserId"='owner-b' WHERE id='vault-a'`
      ]) await rejected(db, () => db.exec(sql));
    });
    await t.test('ingestion and anchor replay keys are unique per custody', async () => {
      await rejected(db, () => insert(db,'FoundationSource',{id:'replay',...scope,kind:'OWNER_NOTE',ingestKey:'synthetic-key',updatedAt:new Date()}),'23505');
      await rejected(db, () => insert(db,'FoundationEvidenceSegment',{id:'replay-anchor',...scope,sourceVersionId:'source-v1',anchorEnc:'x',excerptEnc:'x',anchorMac:'synthetic-anchor'}),'23505');
    });
    await t.test('statement with no subjects/support is rejected at commit', async () => {
      await rejected(db, async () => {
        await insert(db,'FoundationStatement',{id:'incomplete',...scope,perspectiveId:'perspective-a',updatedAt:new Date()});
        await insert(db,'FoundationStatementVersion',{id:'incomplete-v',...scope,statementId:'incomplete',version:1,textEnc:'x',mode:'INFERRED',confidence:'LOW',provenanceEnc:'x'});
      });
      assert.equal((await db.query(`SELECT count(*)::int n FROM "FoundationStatement" WHERE id='incomplete'`)).rows[0].n,0);
    });
    await t.test('complete relationship understanding and multi-subject evidence commit', async () => {
      await db.transaction(async tx => { await statement(tx,'claim-a'); await statement(tx,'claim-b','claim-a-v1'); });
      assert.equal((await db.query(`SELECT count(*)::int n FROM "FoundationEvidenceSubject" WHERE "segmentId"='segment-a'`)).rows[0].n,2);
    });
    await t.test('statement version corrections reject NULL lineage and preserve old text', async () => {
      await rejected(db, () => db.exec(`UPDATE "FoundationStatementVersion" SET "textEnc"='changed' WHERE id='claim-a-v1'`));
      const version={id:'claim-a-v2',...scope,statementId:'claim-a',version:2,previousVersionId:'claim-a-v1',previousVersionNumber:1,textEnc:'corrected',mode:'OBSERVED',confidence:'MEDIUM',provenanceEnc:'synthetic'};
      await rejected(db, () => insert(db,'FoundationStatementVersion',{...version,previousVersionNumber:null}));
      await rejected(db, () => insert(db,'FoundationStatementVersion',{...version,previousVersionId:'claim-b-v1'}),'23503');
      await rejected(db, () => insert(db,'FoundationStatementVersion',{...version,validFrom:new Date('2026-02-02'),validUntil:new Date('2026-01-01')}));
      await db.transaction(async tx => {
        await insert(tx,'FoundationStatementVersion',version);
        await insert(tx,'FoundationStatementSubject',{id:'v2-subject',...scope,statementVersionId:'claim-a-v2',subjectId:'person-a'});
        await insert(tx,'FoundationSupport',{id:'v2-support',...scope,outputVersionId:'claim-a-v2',segmentId:'segment-a',relation:'SUPPORTS'});
      });
      await rejected(db, () => insert(db,'FoundationStatementVersion',{...version,id:'duplicate-claim-v2'}),'23505');
      assert.equal((await db.query(`SELECT "textEnc" FROM "FoundationStatementVersion" WHERE id='claim-a-v1'`)).rows[0].textEnc,'synthetic');
    });
    await t.test('disabled root cannot admit a new incomplete version', async () => {
      await rejected(db, async () => {
        await insert(db,'FoundationStatement',{id:'disabled-root',...scope,perspectiveId:'perspective-a',state:'DISABLED',updatedAt:new Date()});
        await insert(db,'FoundationStatementVersion',{id:'disabled-version',...scope,statementId:'disabled-root',version:1,textEnc:'x',mode:'INFERRED',confidence:'LOW',provenanceEnc:'x'});
      });
    });
    await t.test('cycles and self-dependency are rejected through raw SQL', async () => {
      await rejected(db, () => insert(db,'FoundationSupport',{id:'cycle',...scope,outputVersionId:'claim-a-v1',inputVersionId:'claim-b-v1',relation:'QUALIFIES'}));
      await rejected(db, () => insert(db,'FoundationSupport',{id:'self-cycle',...scope,outputVersionId:'claim-a-v1',inputVersionId:'claim-a-v1',relation:'SUPPORTS'}));
      // A caller-controlled temporary table must not shadow the integrity graph.
      await db.exec('CREATE TEMP TABLE "FoundationSupport" (LIKE public."FoundationSupport")');
      try {
        await rejected(db, () => db.exec(`INSERT INTO public."FoundationSupport" (id,"ownerUserId","vaultId","outputVersionId","inputVersionId",relation) VALUES ('shadow-cycle','owner-a','vault-a','claim-a-v1','claim-b-v1','QUALIFIES')`));
      } finally { await db.exec('DROP TABLE pg_temp."FoundationSupport"'); }

    });
    await t.test('support XOR, duplicate and last-support/subject removal checks', async () => {
      await rejected(db, () => insert(db,'FoundationSupport',{id:'no-input',...scope,outputVersionId:'claim-a-v1',relation:'SUPPORTS'}));
      await rejected(db, () => insert(db,'FoundationSupport',{id:'two-inputs',...scope,outputVersionId:'claim-b-v1',segmentId:'segment-a',inputVersionId:'claim-a-v1',relation:'SUPPORTS'}));
      await rejected(db, () => insert(db,'FoundationSupport',{id:'duplicate-support',...scope,outputVersionId:'claim-a-v1',segmentId:'segment-a',relation:'SUPPORTS'}),'23505');
      await rejected(db, () => db.exec(`DELETE FROM "FoundationSupport" WHERE id='claim-a-support'`));
      await rejected(db, () => db.exec(`DELETE FROM "FoundationStatementSubject" WHERE id='claim-a-subject'`));
    });
    await t.test('reactivation cannot restore an unsupported statement', async () => {
      await db.exec(`UPDATE "FoundationStatement" SET state='DELETING' WHERE id='claim-b'`);
      await db.exec(`DELETE FROM "FoundationSupport" WHERE id='claim-b-support'`);
      await rejected(db, () => db.exec(`UPDATE "FoundationStatement" SET state='ACTIVE' WHERE id='claim-b'`));
      // Ordered erasure leaves the independent supporting statement intact.
      await db.exec(`DELETE FROM "FoundationStatementSubject" WHERE id='claim-b-subject'; DELETE FROM "FoundationStatementVersion" WHERE id='claim-b-v1'; DELETE FROM "FoundationStatement" WHERE id='claim-b';`);
      assert.equal((await db.query(`SELECT count(*)::int n FROM "FoundationStatement" WHERE id='claim-a'`)).rows[0].n,1);
    });
    await t.test('semantic context associations enforce XOR without creating grants', async () => {
      await insert(db,'FoundationContext',{id:'context-a',...scope,labelEnc:'synthetic'});
      await rejected(db, () => insert(db,'FoundationContextAssociation',{id:'no-target',...scope,contextId:'context-a'}));
      await insert(db,'FoundationContextAssociation',{id:'context-link',...scope,contextId:'context-a',segmentId:'segment-a'});
      await rejected(db, () => insert(db,'FoundationContextAssociation',{id:'duplicate-context-link',...scope,contextId:'context-a',segmentId:'segment-a'}),'23505');
    });
    await t.test('enrolment requires monotonic epoch and User deletion is restricted', async () => {
      await rejected(db, () => db.exec(`UPDATE "FoundationEnrollment" SET state='ACTIVE' WHERE "userId"='owner-a'`));
      await db.exec(`UPDATE "FoundationEnrollment" SET state='SUSPENDED',epoch=2 WHERE "userId"='owner-a'`);
      await rejected(db, () => db.exec(`UPDATE "FoundationEnrollment" SET epoch=1 WHERE "userId"='owner-a'`));
      await rejected(db, () => db.exec(`DELETE FROM "User" WHERE id='owner-a'`),['23503','23001']);
    });
    await t.test('generated Prisma client works against migrated PostgreSQL', async () => {
      const server = new PGLiteSocketServer({db,host:'127.0.0.1',port:0,maxConnections:1});
      await server.start();
      const prisma = new PrismaClient({datasourceUrl:`postgresql://postgres:postgres@${server.getServerConn()}/postgres?connection_limit=1`});
      try {
        const subject = await prisma.foundationSubject.findUnique({where:{id:'relationship-a'}});
        assert.equal(subject.kind,'RELATIONSHIP');
        await assert.rejects(prisma.foundationSubject.create({data:{...scope,vaultId:'vault-b',kind:'PERSON',displayNameEnc:'synthetic'}}), e => e.code==='P2003');
        await prisma.$transaction(async tx => {
          await tx.foundationSubject.create({data:{id:'prisma-person',...scope,kind:'PERSON',displayNameEnc:'synthetic'}});
        });
      } finally { await prisma.$disconnect(); await server.stop(); }
    });
    await t.test('all legacy fixture rows remain unchanged after adversarial tests', async () => {
      assert.deepEqual(await legacySnapshot(db),before);
    });
    await db.close();
    db = await PGlite.create({extensions:{vector},loadDataDir:snapshot});
    await t.test('restore pre-migration snapshot and replay migration', async () => {
      assert.equal((await db.query(`SELECT count(*)::int n FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'Foundation%'`)).rows[0].n,0);
      assert.deepEqual(await legacySnapshot(db),before);
      // Inject failure after DDL to prove the migration's BEGIN/COMMIT is atomic.
      const broken = migration.replace(/COMMIT;\s*$/, 'SELECT f202_deliberately_missing_function(); COMMIT;');
      await assert.rejects(db.exec(broken), e=>e.code==='42883');
      await db.exec('ROLLBACK');
      assert.equal((await db.query(`SELECT count(*)::int n FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'Foundation%'`)).rows[0].n,0);
      await db.exec(migration);
      assert.deepEqual(await legacySnapshot(db),before);
      assert.equal((await db.query(`SELECT count(*)::int n FROM "FoundationSubject"`)).rows[0].n,0);
    });
    await t.test('duplicate application fails transactionally without changing rows', async () => {
      await assert.rejects(db.exec(migration),e=>e.code==='42710');
      await db.exec('ROLLBACK');
      assert.deepEqual(await legacySnapshot(db),before);
    });
  } finally { await db.close(); }
});
