// Static contract tests, NOT a substitute for Neon and voice-provider integration tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = p => readFileSync(new URL(`../../${p}`,import.meta.url),'utf8');

test('opt-in automated pipeline invokes existing initial adoption and impact approval', () => {
  const s=read('src/lib/server/core/phoneUnderstandingAutomation.ts');
  for(const name of ['identifySemanticAreasReadOnly','reviseSemanticAreaReadOnly','restructureLivingUnderstandingReadOnly','createLivingUnderstandingAdoptionToken','adoptLivingUnderstanding','prepareAutomaticLivingUnderstandingImpact','approvePreparedLivingUnderstandingImpact']) assert.ok(s.includes(name),name);
  assert.match(s,/RELISH_PHONE_AUTO_LU\s*===\s*'YES'/);
});
test('gate is durable and scoped to one caller and conversation',()=>{
  const s=read('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts');
  assert.match(s,/understandingState:\s*'READY'/);
  assert.match(s,/understandingConversationId:\s*input\.conversationId/);
  const webhook=read('src/lib/server/core/phoneUnderstandingAutomation.ts');
  assert.match(webhook,/where:\s*\{understandingConversationId:conversationId\}/);
  assert.ok(existsSync(new URL('../../prisma/migrations/20261022110000_stage8_15_4_7f_provisional_understanding_gate/migration.sql',import.meta.url)));
});
test('private learning does not change sharing permissions',()=>{
  const s=read('src/lib/server/core/phoneUnderstandingAutomation.ts');
  assert.doesNotMatch(s,/updateMany\(\{[^]*matchEligible|shareable|disclosurePermission/);
});
test('empty calls release the gate and worker owns processing failures',()=>{
  const webhook=read('src/routes/api/webhooks/elevenlabs/+server.ts');
  assert.match(webhook,/finishPhoneUnderstanding\(event\.data\.conversation_id, 'READY'\)/);
  const worker=read('scripts/process-stage8-15-4-7f-2-phone-queue.ts');
  assert.match(worker,/finishPhoneUnderstanding\(conversationId, 'FAILED'\)/);
});
