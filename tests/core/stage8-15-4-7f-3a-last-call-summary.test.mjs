// Stage 8.15.4.7f.3a: Source regression checks for recent-conversation continuity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../../src/lib/server/integrations/elevenlabs/phoneOnboarding.ts', import.meta.url), 'utf8');

test('reads only caller-owned imported conversation summaries', () => {
  assert.match(code, /runWithWorkspaceCustody\(/);
  assert.match(code, /prisma\.interaction\.findFirst\(/);
  assert.match(code, /userId: selected\.userId, contextSpaceId: selected\.contextSpaceId/);
  assert.match(code, /contactId: selected\.contactId, channel: PERSON_CONVERSATION_SOURCE_CHANNEL/);
  assert.match(code, /summaryEnc: \{ not: null \}/);
  assert.match(code, /orderBy: \[\{ occurredAt: 'desc' \}, \{ createdAt: 'desc' \}\]/);
});
test('decrypts and bounds last meaningful conversation summary', () => {
  assert.match(code, /decryptInteractionSummary\(latestSummarisedCall\?\.summaryEnc\)/);
  assert.match(code, /\.slice\(0, 1600\)/);
  assert.match(code, /lastCallSummary = ''/);
});
test('passes summary in initiation alongside unchanged long-term variables', () => {
  assert.match(code, /last_call_summary: input\.lastCallSummary \|\| ''/);
  assert.match(code, /living_understanding: input\.livingContext \|\| ''/);
  assert.match(code, /memory_and_identity_context: input\.livingContext \|\| ''/);
  assert.match(code, /livingRevision, lastCallSummary, domainKey: selected\.domainKey/);
});
