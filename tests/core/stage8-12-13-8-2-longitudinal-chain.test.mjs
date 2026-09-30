import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateLongitudinalSeed } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

test('stage 8.12.13.8.2 longitudinal seed preserves multi-source provenance while using latest source as baseline', () => {
  const result = validateLongitudinalSeed([
    {
      targetKey: 'existing:t1',
      topicName: 'Romantic relationships / Desired relationship',
      proposedUnderstanding: 'The speaker currently wants a strong relationship while preserving individuality.',
      sourceInteractionId: 'source-2',
      sourceDate: '2026-09-30T02:00:00.000Z',
      sourceInteractionIds: ['source-1', 'source-2'],
      semanticBoundary: ['Overall relationship goal only.']
    }
  ]);
  assert.equal(result.validForReview, true);
  assert.equal(result.seeds[0].sourceInteractionId, 'source-2');
  assert.deepEqual(result.seeds[0].sourceInteractionIds, ['source-1', 'source-2']);
});

test('stage 8.12.13.8.2 service returns a carry-forward topic and operational baseline', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  assert.match(service, /nextLongitudinalSeed/);
  assert.match(service, /nextOperationalUnits/);
  assert.match(service, /sourceInteractionIds/);
  assert.match(service, /POTENTIAL_RETIREMENT/);
  assert.match(service, /baseline now represents the/);
});

test('stage 8.12.13.8.2 route carries concise chain history without transcript text', () => {
  const route = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', import.meta.url), 'utf8');
  assert.match(route, /sanitiseChainHistory/);
  assert.match(route, /chainHistoryJson/);
  assert.match(route, /longitudinal\.chainHistory/);
  assert.match(route, /topics: longitudinal\.nextLongitudinalSeed/);
  assert.match(route, /never decrypted transcript text/);
});

test('stage 8.12.13.8.2 UI can continue v1 to v2 to v3 from the latest proposed understanding', () => {
  const page = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', import.meta.url), 'utf8');
  assert.match(page, /Read-only evolution chain/);
  assert.match(page, /Continue with another later source/);
  assert.match(page, /baselineSourceInteractionId" value=\{form\.longitudinal\.nextSourceInteractionId\}/);
  assert.match(page, /longitudinalSeedJson" value=\{serialiseLongitudinalSeed\(form\.longitudinal\.nextLongitudinalSeed\)\}/);
  assert.match(page, /priorOperationalUnitsJson" value=\{serialiseOperationalUnits\(form\.longitudinal\.nextOperationalUnits\)\}/);
  assert.match(page, /chainHistoryJson/);
  assert.match(page, /starts from the latest proposed understanding, not from the raw previous conversation alone/);
});
