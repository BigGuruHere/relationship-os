// PURPOSE: Ensure a single Confirm action automatically records corrections per review element.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewDatingElements, DATING_ELEMENT_DECISIONS, DATING_REVIEW_ELEMENTS } from '../../src/lib/datingElementReview.ts';

const original = {
  schemaVersion: 'dating_outcome_proposal.v1', proposalVersion: 1,
  introductionId: 'intro', sourceInteractionId: 'source', respondentParticipantId: 'respondent',
  personalExperience: { summary: 'I enjoyed meeting.', evidence: [] },
  selfLearning: { summary: 'I value patience.', evidence: [] },
  otherPersonExperience: { summary: 'I thought they enjoyed meeting.', evidence: [] },
  relationshipDynamic: { summary: 'Conversation flowed.', evidence: [] },
  desireToContinue: { summary: 'I might meet again.', value: 'UNSURE', evidence: [] },
  wholeOutcome: { status: 'CONTINUING', useful: true, continued: true, result: 'Possibly another meeting.', notes: '' },
  consent: { shareWithOtherAllowed: false, privateLearningAllowed: true, futureMatchingAllowed: false },
  confidence: 0.7
};
function form() {
  const f = new FormData();
  for (const element of DATING_REVIEW_ELEMENTS) f.set(`reviewDecision_${element}`, 'CONFIRMED');
  return f;
}
test('UI offers three decisions and no separate correction selection', () => {
  assert.deepEqual(DATING_ELEMENT_DECISIONS.map(item => item.label), ['Confirm', 'Reject', 'Not sure yet']);
  const page = readFileSync(new URL('../../src/routes/dating/feedback/[id]/+page.svelte', import.meta.url), 'utf8');
  assert.match(page, /Edit any proposed text or values/);
  assert.match(page, /\{#each data\.elementDecisions as decision\}/);
});
test('confirming a changed summary records CORRECTED, other elements stay independently confirmed', () => {
  const edited = structuredClone(original);
  edited.personalExperience.summary = 'I was uncertain during the meeting.';
  const result = reviewDatingElements(original, edited, form());
  assert.equal(result.elements[0].decision, 'CORRECTED');
  assert.equal(result.elements[0].reviewedText, edited.personalExperience.summary);
  assert.equal(result.elements[1].decision, 'CONFIRMED');
  assert.equal(result.elements[0].attribution, 'RESPONDENT_ACCOUNT');
});
test('changing a structured value automatically marks its section corrected', () => {
  const edited = structuredClone(original);
  edited.wholeOutcome.continued = false;
  edited.desireToContinue.value = 'NO';
  const result = reviewDatingElements(original, edited, form());
  assert.equal(result.elements.find(e => e.element === 'wholeOutcome').decision, 'CORRECTED');
  assert.equal(result.elements.find(e => e.element === 'desireToContinue').decision, 'CORRECTED');
  assert.equal(result.createOutcome, true);
});
test('reject and defer remain independent even if fields were edited', () => {
  const edited = structuredClone(original); edited.otherPersonExperience.summary = 'Unsupported speculation';
  const decisions = form();
  decisions.set('reviewDecision_otherPersonExperience', 'REJECTED');
  decisions.set('reviewDecision_wholeOutcome', 'DEFERRED');
  const result = reviewDatingElements(original, edited, decisions);
  assert.equal(result.createOutcome, false);
  assert.equal(result.proposal.otherPersonExperience.summary, '');
  assert.equal(result.proposal.wholeOutcome.status, 'UNKNOWN');
  assert.equal(result.elements.find(e => e.element === 'otherPersonExperience').reviewedText, null);
});
test('source proposal stays untouched after automatic correction', () => {
  const edited = structuredClone(original); edited.relationshipDynamic.summary = 'It was awkward.';
  const result = reviewDatingElements(original, edited, form());
  assert.equal(original.relationshipDynamic.summary, 'Conversation flowed.');
  assert.equal(result.proposal.relationshipDynamic.summary, 'It was awkward.');
  assert.equal(result.elements.find(e => e.element === 'relationshipDynamic').sourceInteractionId, 'source');
});
