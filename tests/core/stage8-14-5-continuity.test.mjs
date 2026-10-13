import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ElevenLabs adapter captures provider transcript summary and initiation projects recent continuity', () => {
  const adapter = fs.readFileSync('src/lib/server/integrations/elevenlabs/conversation.ts', 'utf8');
  const initiation = fs.readFileSync('src/lib/server/integrations/elevenlabs/initiation.ts', 'utf8');
  const inbox = fs.readFileSync('src/lib/server/core/conversationInbox.ts', 'utf8');
  assert.match(adapter, /analysis\.transcript_summary/);
  assert.match(inbox, /summaryEnc: metadata\.summary \? encryptInteractionSummary/);
  assert.match(initiation, /previous_calls: String\(input\.previousCalls \?\? 0\)/);
  assert.match(initiation, /last_call_summary: input\.lastCallSummary \|\| ''/);
  assert.match(initiation, /PERSON_CONVERSATION_SOURCE_CHANNEL/);
});

test('review UI confirms dismiss and preserves restore path', () => {
  const page = fs.readFileSync('src/routes/general/admin/reviews/+page.svelte', 'utf8');
  const helper = fs.readFileSync('src/lib/server/core/livingUnderstandingReviewDisposition.ts', 'utf8');
  assert.match(page, /window\.confirm\('Dismiss this conversation from Living Understanding review\?/);
  assert.match(page, /action="\?\/dismiss"/);
  assert.match(page, /action="\?\/restore"/);
  assert.match(helper, /status: 'DISMISSED'/);
  assert.match(helper, /status: 'ACTIVE'/);
});

test('dismissed sources are blocked from LU review/approval until restored', () => {
  const impact = fs.readFileSync('src/routes/dating/people/[id]/understanding/impact-review/+page.server.ts', 'utf8');
  const initial = fs.readFileSync('src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', 'utf8');
  assert.match(impact, /This conversation was dismissed from Living Understanding review/);
  assert.match(impact, /This conversation was dismissed\. Restore it before approval/);
  assert.match(initial, /This conversation was dismissed from Living Understanding review/);
  assert.match(initial, /This conversation was dismissed\. Restore it before approval/);
});

test('cross-custody policies permit only continuity reads required at initiation and dismissal lookup during ingest', () => {
  const policy = fs.readFileSync('src/lib/server/core/contextSpace.ts', 'utf8');
  assert.match(policy, /ELEVENLABS_CONVERSATION_INITIATION:[\s\S]*Interaction: new Set\(\['findFirst', 'count'\]\)/);
  assert.match(policy, /ELEVENLABS_CONVERSATION_INGEST:[\s\S]*LivingUnderstandingSourceReviewDisposition: new Set\(\['findFirst'\]\)/);
});
