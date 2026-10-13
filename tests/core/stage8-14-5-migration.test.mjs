import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Stage 8.14.5 disposition migration is additive and constrained', () => {
  const sql = fs.readFileSync('prisma/migrations/20261013090000_stage8_14_5_conversation_review_continuity/migration.sql', 'utf8');
  assert.match(sql, /CREATE TABLE "public"\."LivingUnderstandingSourceReviewDisposition"/);
  assert.match(sql, /CHECK \("status" IN \('ACTIVE', 'DISMISSED'\)\)/);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|DROP CONSTRAINT/);
});
