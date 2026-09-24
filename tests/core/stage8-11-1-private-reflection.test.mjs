// PURPOSE: Exercise the privacy-oriented next-step contract without needing a database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewedDatingOutcomeProposal } from '../../src/lib/datingOutcome.ts';
import { normaliseDatingPrivateNextStep, datingNextStepLabel, DATING_NEXT_STEP_OPTIONS } from '../../src/lib/datingNextStep.ts';

test('all five private next steps normalise and have labels', () => {
  for (const option of DATING_NEXT_STEP_OPTIONS) {
    assert.equal(normaliseDatingPrivateNextStep(option.value, '').choice, option.value);
    assert.equal(datingNextStepLabel(option.value), option.label);
  }
});

test('unknown and missing choices cannot be interpreted as consent', () => {
  assert.throws(() => normaliseDatingPrivateNextStep('SHARE_WITH_OTHER', ''), /valid private next step/);
  assert.throws(() => normaliseDatingPrivateNextStep(null, ''), /valid private next step/);
});

test('private notes are bounded and sanitised', () => {
  const result = normaliseDatingPrivateNextStep('PAUSE', '  hello\0' + 'x'.repeat(2000));
  assert.ok(!result.note.includes('\0'));
  assert.equal(result.note.length, 1000);
});

test('the private choice is encrypted with the reviewed artifact and never added to the canonical Outcome', () => {
  // Source-level invariant supplements, but does not replace, the real PostgreSQL test.
  const src = readFileSync(new URL('../../src/lib/server/datingOutcomePilot.ts', import.meta.url), 'utf8');
  assert.match(src, /contentEnc: encrypt\(JSON\.stringify\(reviewedContent\)/);
  assert.match(src, /const reviewedContent = \{ \.\.\.proposal, privateNextStep \}/);
  const outcomeBlock = src.split('const outcome = await tx.outcome.create(')[1].split('const updated =')[0];
  assert.doesNotMatch(outcomeBlock, /privateNextStep/);
});

test('review cannot widen consent or silently disclose the private next step', () => {
  const base = {
    proposalVersion: 1, introductionId: 'intro', respondentParticipantId: 'participant',
    sourceInteractionId: 'interaction', confidence: 0.8,
    consent: { confirmedAt: '2026-01-01T00:00:00Z', privateLearningAllowed: true,
      futureMatchingAllowed: false, shareWithOtherAllowed: false },
    personalExperience: { summary: 'I felt at ease.', evidence: [] },
    selfLearning: { summary: '', evidence: [] },
    otherPersonExperience: { summary: '', evidence: [] },
    relationshipDynamic: { summary: '', evidence: [] },
    desireToContinue: { value: 'UNSURE', summary: '', evidence: [] },
    wholeOutcome: { status: 'UNKNOWN', useful: null, continued: null, result: '', notes: '' }
  };
  const form = new FormData();
  form.set('futureMatchingAllowed', 'true');
  form.set('shareWithOtherAllowed', 'true');
  const result = reviewedDatingOutcomeProposal(base, form);
  assert.equal(result.consent.futureMatchingAllowed, false);
  assert.equal(result.consent.shareWithOtherAllowed, false);
});
