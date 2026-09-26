// Structural audit independent of Prisma/tsx, so stale Stage 8.6 count changes cannot hide missing protections.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const schema = readFileSync('prisma/schema.prisma','utf8');
const sql = readFileSync('prisma/migrations/20260925123000_stage8_12_1_relating_foundation/migration.sql','utf8');
const four = ['Relating','RelatingParticipant','Touchpoint','TouchpointParticipant'];
const block = (name) => schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
test('four new models have owner, sentinel and inverse ContextSpace relation', () => {
  const contextSpace = block('ContextSpace');
  for (const name of four) {
    assert.match(block(name), /userId\s+String/);
    assert.match(block(name), /contextSpaceId\s+String(?:\s|$)/m);
    assert.doesNotMatch(block(name).match(/contextSpaceId\s+String[^\n]*/)?.[0] ?? '', /@default/);
    assert.match(block(name), /contextSpace\s+ContextSpace\s+@relation/);
    assert.match(contextSpace, new RegExp(`\\b\\w+\\s+${name}\\[\\]`));
  }
});
test('all four new tables have owner and reassignment guards', () => {
  for (const name of four) assert.match(sql, new RegExp(`ARRAY\\['Relating','RelatingParticipant','Touchpoint','TouchpointParticipant'\\]`));
  assert.match(sql, /relish_enforce_context_owner/);
  assert.match(sql, /relish_prevent_context_reassignment/);
});
test('the new database boundaries use composite keys or specialised context checks', () => {
  for (const definition of [
    'RelatingParticipant_relatingId_userId_contextSpaceId_fkey',
    'TouchpointParticipant_touchpointId_userId_contextSpaceId_fkey',
    'TouchpointParticipant_group_member_fkey',
    'RelatingParticipant_entity_guard', 'Touchpoint_relating_link_guard',
    'TouchpointParticipant_entity_guard', 'Introduction_relating_link_guard'
  ]) assert.ok(sql.includes(definition), `Missing ${definition}`);
  for (const fn of ['relish_validate_optional_relating_link','relish_validate_relating_participant','relish_validate_touchpoint_participant']) {
    const body=sql.split(`CREATE FUNCTION "${fn}"`)[1]?.split('$$ LANGUAGE plpgsql;')[0]??'';
    assert.match(body,/"userId"=NEW\."userId"/);
    assert.match(body,/"contextSpaceId"=NEW\."contextSpaceId"/);
  }
});
