// PURPOSE: Execute the element-level review policy without a database, including fail-closed decisions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewDatingElements, DATING_REVIEW_ELEMENTS } from '../../src/lib/datingElementReview.ts';

const original = {
  schemaVersion: 'dating_outcome_proposal.v1', proposalVersion: 1,
  introductionId: 'intro', sourceInteractionId: 'source', respondentParticipantId: 'respondent',
  personalExperience: { summary: 'It felt comfortable.', evidence: ['I felt comfortable.'] },
  selfLearning: { summary: 'I value patience.', evidence: [] },
  otherPersonExperience: { summary: 'I thought they looked happy.', evidence: ['They smiled.'] },
  relationshipDynamic: { summary: 'We talked easily.', evidence: [] },
  desireToContinue: { summary: 'I might meet again.', value: 'UNSURE', evidence: [] },
  wholeOutcome: { status: 'CONTINUING', useful: true, continued: true, result: 'I might meet again.', notes: 'One-sided.' },
  consent: { shareWithOtherAllowed: false, privateLearningAllowed: true, futureMatchingAllowed: false },
  confidence: 0.75
};
const form = (decision = 'CONFIRMED') => {
  const f = new FormData();
  for (const field of DATING_REVIEW_ELEMENTS) f.set(`reviewDecision_${field}`, decision);
  return f;
};
test('requires an explicit decision for every element', () => {
  const f = form(); f.delete('reviewDecision_otherPersonExperience');
  assert.throws(() => reviewDatingElements(original, original, f), /Choose a review decision/);
  f.set('reviewDecision_otherPersonExperience', 'MUTUALLY_CONFIRMED');
  assert.throws(() => reviewDatingElements(original, original, f), /Choose a review decision/);
});
test('confirming unchanged sections preserves respondent-only attribution and source', () => {
  const r = reviewDatingElements(original, original, form(), '2026-09-25T00:00:00.000Z');
  assert.equal(r.createOutcome, true);
  assert.equal(r.elements.length, 6);
  assert.ok(r.elements.every((e) => e.attribution === 'RESPONDENT_ACCOUNT' && e.sourceInteractionId === 'source'));
  assert.equal(r.elements.find((e) => e.element === 'otherPersonExperience').reviewedText, original.otherPersonExperience.summary);
});
test('confirming an edited value records a correction without a second confirm action', () => {
  const edited = structuredClone(original); edited.wholeOutcome.continued = false;
  edited.otherPersonExperience.summary = 'Different claim';
  const r = reviewDatingElements(original, edited, form());
  assert.equal(r.createOutcome, true);
  assert.equal(r.elements.find(e => e.element === 'wholeOutcome').decision, 'CORRECTED');
  assert.equal(r.elements.find(e => e.element === 'otherPersonExperience').decision, 'CORRECTED');
  assert.equal(r.elements.find(e => e.element === 'personalExperience').decision, 'CONFIRMED');
});
test('defer/reject do not create an Outcome and do not preserve unconfirmed fields in approved copy', () => {
  const f = form();
  f.set('reviewDecision_wholeOutcome', 'DEFERRED');
  f.set('reviewDecision_otherPersonExperience', 'REJECTED');
  f.set('reviewDecision_desireToContinue', 'DEFERRED');
  const r = reviewDatingElements(original, original, f);
  assert.equal(r.createOutcome, false);
  assert.equal(r.proposal.wholeOutcome.status, 'UNKNOWN');
  assert.equal(r.proposal.otherPersonExperience.summary, '');
  assert.deepEqual(r.proposal.otherPersonExperience.evidence, []);
  assert.equal(r.proposal.desireToContinue.value, 'NOT_STATED');
  assert.equal(r.elements.find(e => e.element === 'otherPersonExperience').reviewedText, null);
  assert.equal(original.otherPersonExperience.summary, 'I thought they looked happy.');
});
test('legacy corrected form values still require a real edit', () => {
  const f = form(); f.set('reviewDecision_personalExperience', 'CORRECTED');
  assert.throws(() => reviewDatingElements(original, original, f), /Correct personalExperience/);
  const edited = structuredClone(original); edited.personalExperience.summary = 'I was somewhat comfortable.';
  assert.equal(reviewDatingElements(original, edited, f).elements[0].decision, 'CORRECTED');
});
test('server persists decisions only in encrypted reviewed artifact; Outcome gate is separate', () => {
  const code = readFileSync(new URL('../../src/lib/server/datingOutcomePilot.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../../src/routes/dating/feedback/[id]/+page.svelte', import.meta.url), 'utf8');
  assert.match(code, /contentEnc: encrypt\(JSON\.stringify\(reviewedContent\)/);
  assert.match(code, /const outcome = elementReview\.createOutcome \?/);
  assert.match(page, /reviewDecision_wholeOutcome/);
  assert.match(page, /reviewDecision_otherPersonExperience/);
  assert.doesNotMatch(code.split('structuredJson: {\n\t\t\t\t\tredacted: true,')[1]?.split('entityType:')[0] ?? '', /elementReviews/);
});
