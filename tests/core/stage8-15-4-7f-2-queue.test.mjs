// Source contract only. Database concurrency and real AI processing still need live tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const webhook = readFileSync('src/routes/api/webhooks/elevenlabs/+server.ts','utf8');
const worker = readFileSync('scripts/process-stage8-15-4-7f-2-phone-queue.ts','utf8');
test('webhook queues after ingestion without running AI inline',()=>{
  assert.match(webhook,/await beginPhoneUnderstanding\(normalized\.metadata\.externalConversationId\)/);
  assert.match(webhook,/status: 'QUEUED'/);
  assert.doesNotMatch(webhook,/await runWithWorkspaceCustody\([\s\S]*?processPhoneUnderstanding\(/);
});
test('worker atomically claims processing state and resolves scoped evidence',()=>{
  assert.match(worker,/understandingState: 'WORKING'/);
  assert.match(worker,/understandingState: 'PROCESSING'/);
  assert.match(worker,/contactId: caller.contactId/);
  assert.match(worker,/processPhoneUnderstanding\(/);
});
test('worker is explicitly development gated',()=>{
  assert.match(worker,/RELISH_DB_ENV !== 'development'/);
  assert.match(worker,/ALLOW_RELISH_PHONE_DEV_DB_TEST !== 'YES'/);
});
