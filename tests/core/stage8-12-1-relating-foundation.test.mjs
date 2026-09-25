// Stage 8.12.1 structural regressions. The separate opt-in DB test verifies actual constraints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const schema = readFileSync('prisma/schema.prisma', 'utf8');
const sql = readFileSync('prisma/migrations/20260925123000_stage8_12_1_relating_foundation/migration.sql', 'utf8');
const service = readFileSync('src/lib/server/relating.ts', 'utf8');
const introductions = readFileSync('src/lib/server/introductions.ts', 'utf8');
const custody = readFileSync('src/lib/server/core/contextSpace.ts', 'utf8');
const model = name => schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? '';

test('Relating and Touchpoint each have unlimited participants, not hard-coded slots', () => {
  for (const name of ['Relating', 'Touchpoint']) {
    assert.match(model(name), /participants\s+(?:RelatingParticipant|TouchpointParticipant)\[\]/);
    assert.doesNotMatch(model(name), /personAId|personBId|participantCId/);
  }
  assert.match(model('RelatingParticipant'), /relatingId\s+String/);
  assert.match(model('TouchpointParticipant'), /touchpointId\s+String/);
  assert.match(model('TouchpointParticipant'), /relatingParticipantId\s+String\?/);
});

test('A touchpoint can be independent of a group, and attendance differs from membership', () => {
  assert.match(model('Touchpoint'), /relatingId\s+String\?/);
  assert.match(sql, /TouchpointParticipant_membership_or_direct_check/);
  assert.match(sql, /TouchpointParticipant_entity_guard/);
  assert.match(sql, /event_group IS NULL OR member_group IS NULL OR event_group <> member_group/);
});

test('Every new model participates in Prisma custody scoping and database context triggers', () => {
  for (const name of ['Relating', 'RelatingParticipant', 'Touchpoint', 'TouchpointParticipant']) {
    assert.match(model(name), /userId\s+String/);
    assert.match(model(name), /contextSpaceId\s+String/);
    assert.ok(custody.includes(`'${name}'`), `${name} is missing from custody middleware`);
  }
  assert.match(sql, /relish_enforce_context_owner/);
  assert.match(sql, /relish_prevent_context_reassignment/);
  assert.match(sql, /RelatingParticipant_entity_guard/);
  assert.match(sql, /TouchpointParticipant_entity_guard/);
  assert.match(sql, /RelatingParticipant_has_identity_check/);
  assert.match(sql, /Introduction_relating_link_guard/);
  assert.match(sql, /Touchpoint_relating_link_guard/);
});

test('Existing introductions are linked without rewriting review/outcome records', () => {
  assert.match(model('Introduction'), /relatingId String\?/);
  assert.match(sql, /INSERT INTO "Relating"[\s\S]*FROM "Introduction"/);
  assert.match(sql, /UPDATE "Introduction" SET "relatingId"="id"/);
  assert.match(sql, /INSERT INTO "RelatingParticipant"[\s\S]*FROM "IntroductionParticipant"/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM "Outcome"|DELETE FROM "ApprovalRequest"/i);
  assert.match(introductions, /tx\.relating\.create/);
  assert.match(introductions, /relatingId: relating\.id/);
  assert.match(introductions, /tx\.relatingParticipant\.createMany/);
});

test('Foundation writes are custody-checked; no automatic sharing or relationship classification', () => {
  assert.match(service, /requireScope\(scope\)/);
  assert.match(service, /createTouchpoint/);
  assert.match(service, /createRelating/);
  assert.doesNotMatch(service, /disclosureGrant\.create|relationshipStatus:\s*'ESTABLISHED'/);
  assert.match(sql, /private history container/);
});
