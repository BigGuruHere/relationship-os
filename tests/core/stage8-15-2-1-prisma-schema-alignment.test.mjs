// IT: Guard the deployed Stage 8.13/8.14.5 index and foreign-key names against Prisma migration churn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
const dispositionSql = readFileSync(new URL('../../prisma/migrations/20261013090000_stage8_14_5_conversation_review_continuity/migration.sql', import.meta.url), 'utf8');
const luSql = readFileSync(new URL('../../prisma/migrations/20261002010000_stage8_13_0_longitudinal_living_understanding_foundation/migration.sql', import.meta.url), 'utf8');
const block = (name) => {
  // IT: Use exact Prisma model boundaries to avoid false positives from neighbouring models.
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Model ${name} missing`);
  return match[1];
};
test('review dispositions retain four deployed foreign keys and their inverse relations', () => {
  const disposition = block('LivingUnderstandingSourceReviewDisposition');
  for (const [column, model, inverse, fk] of [
    ['userId','User','User','user'],
    ['contextSpaceId','ContextSpace','ContextSpace','context'],
    ['contactId','Contact','Contact','contact'],
    ['sourceInteractionId','Interaction','Interaction','source']
  ]) {
    assert.match(disposition, new RegExp(`@relation\\(fields: \\[${column}\\], references: \\[id\\], onDelete: Cascade, map: "LivingUnderstandingSourceReviewDisposition_${fk}_fk"\\)`));
    assert.match(block(inverse), /livingUnderstandingReviewDispositions LivingUnderstandingSourceReviewDisposition\[\]/);
    assert.ok(dispositionSql.includes(`"LivingUnderstandingSourceReviewDisposition_${fk}_fk"`));
  }
  assert.match(disposition, /updatedAt DateTime @default\(now\(\)\) @updatedAt/);
});
test('deployed LU index names are mapped instead of renamed', () => {
  const models = ['LivingUnderstandingRevision','LivingUnderstandingTopicIdentity','LivingUnderstandingTopicVersion','LivingUnderstandingRevisionTopic','LivingUnderstandingRevisionSource','LivingUnderstandingTopicVersionSource'];
  let count=0;
  for (const name of models) {
    const actual=block(name);
    const re=/CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"/g;
    for (const match of luSql.matchAll(re)) {
      if (match[2] !== name) continue;
      const indexName=match[1].slice(0,63);
      if (!indexName.startsWith(`${name}_id_userId_contextSpaceId`) && !indexName.startsWith(`${name}_userId_contextSpaceId`) && indexName !== 'LivingUnderstandingRevisionTopic_scope_revision_position_idx') continue;
      assert.ok(actual.includes(`map: "${indexName}"`), `Missing map for ${indexName}`);
      count++;
    }
  }
  assert.equal(count,10);
});
