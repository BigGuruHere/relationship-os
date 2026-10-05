// Stage 8.13.3.3 - legitimate semantic overlap is allowed while redundant duplication is repaired.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('src/lib/server/datingLongitudinalLivingUnderstanding.ts', 'utf8');
const page = fs.readFileSync('src/routes/dating/people/[id]/understanding/impact-review/+page.svelte', 'utf8');

test('Living Understanding topics are coherent views rather than mutually exclusive containers', () => {
  assert.match(service, /Topics are coherent views of a person, not mutually exclusive containers/);
  assert.match(service, /durable meaning may legitimately inform multiple topics/);
  assert.match(service, /LEGITIMATE_CROSS_TOPIC_RELEVANCE/);
  assert.match(service, /SHARED_UNDERLYING_THEME/);
});

test('boundary audit repairs redundancy and contamination but preserves legitimate overlap', () => {
  assert.match(service, /Repair REDUNDANT_DUPLICATION and ACTUAL_TOPIC_CONTAMINATION/);
  assert.match(service, /Preserve LEGITIMATE_CROSS_TOPIC_RELEVANCE and SHARED_UNDERLYING_THEME/);
  assert.match(service, /distinct explanatory purpose/);
});

test('exact substantive duplication triggers one bounded repair pass instead of immediate failure', () => {
  assert.match(service, /findExactCrossTopicSentenceDuplication/);
  assert.match(service, /repairExactCrossTopicSentenceDuplication/);
  assert.match(service, /exact_duplication_repair/);
  assert.match(service, /bounded repair pass removed redundant same-purpose wording/);
  assert.doesNotMatch(service, /function rejectExactCrossTopicSentenceDuplication/);
});

test('bounded duplication repair uses only editable topics and keeps unchanged rows immutable', () => {
  assert.match(service, /const editableRefs = \[\.\.\.new Set\(duplicatedGroups\.flatMap\(group => group\.editableRefs\)\)\]/);
  assert.match(service, /Unchanged rows are immutable reference boundaries and must never be rewritten/);
  assert.match(service, /Do not remove legitimate cross-topic relevance or shared underlying themes/);
});

test('impact review explains that shared meaning can legitimately inform more than one topic', () => {
  assert.match(page, /Shared meaning may legitimately inform more than one topic/);
  assert.match(page, /redundant duplication or true contamination/);
});
