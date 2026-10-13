// Stage 8.14.3 - new ElevenLabs conversation -> explicit Living Understanding review handoff.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const helper = read('../../src/lib/server/core/livingUnderstandingReviewHandoff.ts');
const webhook = read('../../src/routes/api/webhooks/elevenlabs/+server.ts');
const personServer = read('../../src/routes/general/people/[id]/+page.server.ts');
const personPage = read('../../src/routes/general/people/[id]/+page.svelte');
const debug = read('../../src/lib/server/integrations/elevenlabs/debug.ts');
const vite = read('../../vite.config.ts');
const harness = read('../../src/routes/settings/agents/test/+page.server.ts');

test('review handoff preserves explicit human approval and chooses initial vs longitudinal routes', () => {
  assert.match(helper, /INITIAL_REVIEW_READY/);
  assert.match(helper, /IMPACT_REVIEW_READY/);
  assert.match(helper, /ALREADY_APPLIED/);
  assert.match(helper, /\/understanding\/initial\?sourceInteractionId=/);
  assert.match(helper, /\/understanding\/impact-review\?sourceInteractionId=/);
  assert.doesNotMatch(helper, /reviewLivingUnderstandingImpact|approveLivingUnderstandingImpact|generateStructured/);
});

test('post-call bridge surfaces the LU handoff after participant evidence is attached', () => {
  assert.match(webhook, /describeLivingUnderstandingReviewHandoff/);
  assert.match(webhook, /LU_HANDOFF/);
  assert.match(webhook, /livingUnderstandingReview/);
  const attachPos = webhook.indexOf('attachConversationParticipant');
  const handoffPos = webhook.lastIndexOf('describeLivingUnderstandingReviewHandoff');
  assert.ok(handoffPos > attachPos);
});

test('General participant page exposes LU handoff state without duplicating the review workflow', () => {
  assert.match(personServer, /reviewBySourceId/);
  assert.match(personPage, /Pending Living Understanding review/);
  assert.match(personPage, /Pending initial Living Understanding review/);
  assert.match(personPage, /Included in authoritative Living Understanding/);
  assert.match(personPage, /Dismissed from Living Understanding review/);
});

test('normal debug mode stays concise unless full payload logging is explicitly enabled', () => {
  assert.match(debug, /ELEVENLABS_DEBUG_LOG_PAYLOADS/);
  assert.match(debug, /if \(!payloadsEnabled\(\)\) return/);
  assert.doesNotMatch(debug, /payload hidden; set ELEVENLABS_DEBUG_LOG_PAYLOADS/);
});

test('current widget default and ngrok Vite host support remain intact', () => {
  assert.match(harness, /e7b6f115-780d-411b-a68f-1ad3b19364e6/);
  assert.match(vite, /creative-basilisk-painfully\.ngrok-free\.app/);
  assert.match(vite, /allowedHosts/);
});
