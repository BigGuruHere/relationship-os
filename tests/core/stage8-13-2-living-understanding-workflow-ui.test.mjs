import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte', 'utf8');
const initialRoute = fs.readFileSync('src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', 'utf8');
const initialPage = fs.readFileSync('src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', 'utf8');
const semanticService = fs.readFileSync('src/lib/server/datingUnderstandingRevisionExperiment.ts', 'utf8');
const impactPage = fs.readFileSync('src/routes/dating/people/[id]/understanding/impact-review/+page.svelte', 'utf8');

test('8.13.2 reflection review presents a clear first-v1 action when no authoritative baseline exists', () => {
  assert.match(home, /No Living Understanding exists yet/);
  assert.match(home, /Create initial Living Understanding/);
  assert.match(home, /initial=1&sourceInteractionId/);
  assert.doesNotMatch(home, /Create the first Living Understanding using the development experiment/);
});

test('8.13.2 initial workflow is explicit about four production steps and final authority', () => {
  assert.match(initialPage, /1\. Analyse source/);
  assert.match(initialPage, /2\. Generate topic understandings/);
  assert.match(initialPage, /3\. Review structure/);
  assert.match(initialPage, /4\. Approve v1/);
  assert.match(initialPage, /Approve and create authoritative v1/);
  assert.match(initialPage, /Approve and create v1/);
  assert.match(initialPage, /Nothing is authoritative until the final approval step/);
});

test('8.13.2 can structurally validate a one-source initial understanding without forcing a longitudinal experiment', () => {
  assert.match(initialPage, /data\.initialCreationMode && form\.longitudinalSeed/);
  assert.match(initialPage, /action="\?\/restructureTopics"/);
  assert.match(initialPage, /serialiseLongitudinalSeed\(form\.longitudinalSeed\)/);
  assert.match(initialPage, /Add another source before creating v1/);
});

test('8.13.2 first-v1 route is available independently of the diagnostic experiment flag', () => {
  assert.match(initialRoute, /allowInitialCreation/);
  assert.match(initialRoute, /initialCreationMode = url\.searchParams\.get\('initial'\) === '1'/);
  assert.match(initialRoute, /form\.get\('workflowMode'\) === 'INITIAL'/);
  assert.match(initialRoute, /authorisedScope\(locals, params\.id, initialCreationMode\)/);
  assert.match(semanticService, /allowProductionInitial/);
  assert.match(semanticService, /!revisionExperimentEnabled\(\) && !allowProductionInitial/);
});

test('8.13.2 redirects first-v1 entry to longitudinal review once an authoritative baseline exists', () => {
  assert.match(initialRoute, /getCurrentLivingUnderstanding/);
  assert.match(initialRoute, /currentLivingUnderstanding && sourceId/);
  assert.match(initialRoute, /understanding\/impact-review\?sourceInteractionId/);
  assert.match(impactPage, /Review impact on Living Understanding/);
});
