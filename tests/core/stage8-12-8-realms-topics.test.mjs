import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const schema = readFileSync('prisma/schema.prisma', 'utf8');
const sql = readFileSync('prisma/migrations/20260926113000_stage8_12_8_understanding_realms_topics/migration.sql', 'utf8');
const service = readFileSync('src/lib/server/datingUnderstandingTopics.ts', 'utf8');
const page = readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte','utf8');
const route = readFileSync('src/routes/dating/people/[id]/understanding/+page.server.ts','utf8');
const pkg = JSON.parse(readFileSync('package.json','utf8'));
const model = name => schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';

test('realm, topic and claim link require explicit person and space custody', () => {
  for(const name of ['UnderstandingRealm','UnderstandingTopic','UnderstandingTopicClaim']) {
    const body=model(name);
    for(const field of ['userId','contextSpaceId','contactId']) assert.match(body,new RegExp(`\\b${field} String`));
    assert.doesNotMatch(body,/contextSpaceId String @default/);
    assert.match(sql,new RegExp(`"${name}_context_owner_guard"|table_name\\|\\|'_context_owner_guard'`));
  }
  assert.match(sql,/relish_prevent_context_reassignment/);
});

test('topic and claim link use person-level composite foreign keys', () => {
  assert.ok(sql.includes('FOREIGN KEY ("realmId","userId","contextSpaceId","contactId") REFERENCES "UnderstandingRealm"'));
  assert.ok(sql.includes('FOREIGN KEY ("topicId","userId","contextSpaceId","contactId") REFERENCES "UnderstandingTopic"'));
  assert.match(sql,/UnderstandingTopicClaim_person_guard/);
  assert.match(sql,/k\."contactId" = NEW\."contactId"/);
  for(const edge of ["'contactId', 'Contact'","'realmId', 'UnderstandingRealm'","'topicId', 'UnderstandingTopic'","'claimId', 'KnowledgeClaim'"]) assert.ok(sql.includes(edge),edge);
});

test('one claim can belong to several topics without copying its source', () => {
  assert.match(model('UnderstandingTopicClaim'),/@@unique\(\[userId, contextSpaceId, contactId, topicId, claimId\]/);
  assert.doesNotMatch(model('UnderstandingTopicClaim'),/statementEnc|sourceInteraction/);
  assert.match(service,/understandingTopicClaim\.upsert/);
  assert.match(service,/understandingTopicClaim\.deleteMany/);
  assert.match(service,/knowledgeClaim\.findFirst\(\{ where: \{ id: claimId, \.\.\.scope, status: 'ACTIVE' \}/);
});

test('old claims and evidence remain untouched and no automatic migration assigns private knowledge', () => {
  assert.doesNotMatch(sql,/UPDATE "KnowledgeClaim"|UPDATE "KnowledgeEvidence"|INSERT INTO "UnderstandingRealm"/);
  assert.match(service,/requireDatingPerson\(scope\)/);
  assert.match(service,/domainKey: 'dating'/);
  assert.match(service,/nameEnc: encrypt\(/);
  assert.match(service,/decrypt\(realm\.nameEnc/);
  assert.match(page,/Assign a statement to a topic/);
  assert.match(page,/one statement to multiple topics/);
  assert.match(page,/Assigning a statement does not change its evidence/);
  assert.match(route,/assignKnowledgeTopic/);
});

test('new regression is permanently included in npm test and the database suite stays explicitly gated', () => {
  assert.match(pkg.scripts.test,/tests\/core\/\*\.test\.mjs/);
  assert.match(pkg.scripts['check:stage8.12.8'],/stage8-12-8-realms-topics/);
  assert.match(readFileSync('scripts/run-stage-db-tests.mjs','utf8'),/ALLOW_DATING_DEV_DB_TEST/);
});
