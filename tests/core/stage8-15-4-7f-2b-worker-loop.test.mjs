// Stage 8.15.4.7f.2b: source contract tests, not a live Neon substitute.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync('scripts/process-stage8-15-4-7f-2-phone-queue.ts', 'utf8');
test('watch mode runs an independent repeated worker with explicit learning opt-in', () => {
  assert.match(src, /process\.argv\.includes\('--watch'\)/);
  assert.match(src, /await sleep\(POLL_MS\)/);
  assert.match(src, /RELISH_PHONE_AUTO_LU !== 'YES'/);
});
test('worker never automatically releases stale or failed callers', () => {
  assert.match(src, /'IN_CALL', 'WORKING', 'FAILED'/);
  assert.match(src, /operator attention/);
  assert.doesNotMatch(src, /understandingState: 'READY', understandingConversationId: null/);
});
test('individual jobs are atomically claimed and completed only after workflow', () => {
  assert.match(src, /understandingState: 'PROCESSING', understandingConversationId: conversationId/);
  assert.match(src, /processPhoneUnderstanding\(/);
  assert.match(src, /await finishPhoneUnderstanding\(conversationId, 'READY'\)/);
});
