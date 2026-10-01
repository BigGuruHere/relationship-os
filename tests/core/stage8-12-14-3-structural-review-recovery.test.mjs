import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const experiment = fs.readFileSync('src/lib/server/datingUnderstandingRevisionExperiment.ts', 'utf8');
const page = fs.readFileSync('src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', 'utf8');

test('structural review gets exactly one validator-guided repair pass after an invalid first result', () => {
  assert.match(experiment, /if \(!analysis\.validForReview && analysis\.errors\.length\)/);
  assert.equal((experiment.match(/purpose: 'dating_private_topic_restructure_repair'/g) ?? []).length, 1);
  assert.match(experiment, /INVALID STRUCTURAL REVIEW:/);
  assert.match(experiment, /DETERMINISTIC VALIDATOR FAILURES:/);
  assert.match(experiment, /const repairedAnalysis = validateTopicRestructureDraft\(repairAnswer\.structured, priorSeeds\)/);
});

test('repair prompt is constrained to structural completion rather than reinterpretation', () => {
  assert.match(experiment, /Do NOT reconsider, reinterpret, strengthen, weaken, add, delete, or resolve the person knowledge/);
  assert.match(experiment, /Complete missing meaning-unit inventories with exact contiguous excerpts/);
  assert.match(experiment, /Do not invent semantic overlap merely to silence the validator/);
  assert.match(experiment, /Return the COMPLETE repaired review, not a patch or explanation/);
});

test('only a validator-clean repaired result can become reviewable', () => {
  assert.match(experiment, /repairSucceeded = repairedAnalysis\.validForReview/);
  assert.match(page, /Validator-guided repair:/);
  assert.match(page, /one bounded repair pass/);
});
