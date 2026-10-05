import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('src/lib/server/datingLongitudinalLivingUnderstanding.ts', 'utf8');
const persisted = fs.readFileSync('src/lib/server/datingPersistedLivingUnderstanding.ts', 'utf8');
const home = fs.readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte', 'utf8');
const homeServer = fs.readFileSync('src/routes/dating/people/[id]/understanding/+page.server.ts', 'utf8');
const impactPage = fs.readFileSync('src/routes/dating/people/[id]/understanding/impact-review/+page.svelte', 'utf8');

test('8.13.3 audits changed topics against the complete resulting authoritative snapshot', () => {
  assert.match(service, /auditLongitudinalTopicBoundaries/);
  assert.match(service, /FULL RESULTING SNAPSHOT/);
  assert.match(service, /Topics are coherent views of a person, not mutually exclusive containers/);
  assert.match(service, /Audit ONLY rows marked editable/);
  assert.match(service, /unchanged rows are immutable reference boundaries/i);
  assert.match(service, /boundaryReview = await auditLongitudinalTopicBoundaries/);
});

test('8.13.3 gives topic generation explicit neighbouring authoritative boundaries', () => {
  assert.match(service, /OTHER AUTHORITATIVE TOPIC BOUNDARIES/);
  assert.match(service, /EXISTING AUTHORITATIVE TOPIC BOUNDARIES/);
  assert.match(service, /same evidence may legitimately inform another topic/);
});

test('8.13.3 includes a deterministic exact-sentence redundancy detector', () => {
  assert.match(service, /findExactCrossTopicSentenceDuplication/);
  assert.match(service, /repairExactCrossTopicSentenceDuplication/);
});

test('8.13.3 impact review exposes whether semantic boundary repair was required', () => {
  assert.match(impactPage, /Semantic boundary review checked the changed\/new topics/);
  assert.match(impactPage, /boundaryReview\.repairedTopicCount/);
  assert.match(impactPage, /Boundary review details/);
});

test('8.13.3 normal Living Understanding UI hides legacy atomic knowledge tools by default', () => {
  assert.match(homeServer, /DATING_LEGACY_KNOWLEDGE_UI === 'YES'/);
  assert.match(homeServer, /process\.env\.NODE_ENV !== 'production'/);
  assert.match(home, /data\.legacyKnowledgeToolsEnabled/);
  assert.match(home, /Development tools: legacy individual knowledge workflow/);
  assert.match(home, /Review the person's current authoritative Living Understanding/);
});

test('8.13.3 revision history can inspect immutable historical snapshots and topic version numbers', () => {
  assert.match(persisted, /export async function getLivingUnderstandingRevision/);
  assert.match(homeServer, /getLivingUnderstandingRevision\(scope, requestedRevisionNumber\)/);
  assert.match(home, /Authoritative snapshot v/);
  assert.match(home, /topic\.topicVersionNumber/);
  assert.match(home, /changed\/new topic version/);
});


test('8.13.3.1 boundary-audit prompt remains parse-safe around apostrophes', () => {
  assert.doesNotMatch(service, /'[^'\n]*topic's[^'\n]*'/);
});
