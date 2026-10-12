import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const auto = fs.readFileSync('src/lib/server/core/automaticLivingUnderstanding.ts', 'utf8');
const webhook = fs.readFileSync('src/routes/api/webhooks/elevenlabs/+server.ts', 'utf8');
const route = fs.readFileSync('src/routes/dating/people/[id]/understanding/impact-review/+page.server.ts', 'utf8');
const generalPage = fs.readFileSync('src/routes/general/people/[id]/understanding/impact-review/+page.svelte', 'utf8');
const longitudinal = fs.readFileSync('src/lib/server/datingLongitudinalLivingUnderstanding.ts', 'utf8');
const draft = fs.readFileSync('src/lib/server/datingLivingUnderstandingDraft.ts', 'utf8');

test('post-call ingestion automatically prepares only a non-authoritative draft after external custody exits', () => {
  assert.match(webhook, /const ingested = await runWithExternalWorkspaceCustody/);
  assert.match(webhook, /runWithWorkspaceCustody/);
  assert.match(webhook, /prepareAutomaticLivingUnderstandingImpact/);
  assert.match(webhook, /LU_AUTOMATION/);
  assert.match(webhook, /AI proposal failure must[\s\S]*not cause ElevenLabs to retry/);
});

test('automatic preparation persists five inspectable pipeline stages and does not approve', () => {
  for (const stage of ['IMPACT_ANALYSIS','TOPIC_PROPOSAL','SEMANTIC_VALIDATION','BOUNDED_REPAIR','FINAL_CANDIDATE']) {
    assert.match(auto, new RegExp(stage));
  }
  assert.match(auto, /AUTO_PROPOSAL_READY/);
  assert.match(auto, /saveLivingUnderstandingDraft/);
  assert.doesNotMatch(auto.split('prepareAutomaticLivingUnderstandingImpact')[1].split('approvePreparedLivingUnderstandingImpact')[0], /approveLivingUnderstandingImpact/);
});

test('pipeline trace keeps before and after repair evidence', () => {
  assert.match(longitudinal, /topicProposalBeforeValidation/);
  assert.match(longitudinal, /semanticValidation/);
  assert.match(longitudinal, /boundedRepair/);
  assert.match(longitudinal, /before:/);
  assert.match(longitudinal, /after:/);
});

test('encrypted working draft retains the prepared proposal and stage panels without a schema migration', () => {
  assert.match(draft, /pipelineStages\?: unknown\[\]/);
  assert.match(draft, /impactProposal\?: Record<string, unknown>/);
  assert.match(draft, /loadLatestLivingUnderstandingDraftForSource/);
});

test('review UI exposes collapsible panels and keeps final human approval explicit', () => {
  assert.match(generalPage, /IMPACT_ANALYSIS/);
  assert.match(generalPage, /TOPIC_PROPOSAL/);
  assert.match(generalPage, /SEMANTIC_VALIDATION/);
  assert.match(generalPage, /BOUNDED_REPAIR/);
  assert.match(generalPage, /FINAL_CANDIDATE/);
  assert.match(generalPage, /<details class="card stage-panel"/);
  assert.match(route, /approvePreparedImpact/);
  assert.match(generalPage, /I have reviewed the final candidate and approve it/);
});
