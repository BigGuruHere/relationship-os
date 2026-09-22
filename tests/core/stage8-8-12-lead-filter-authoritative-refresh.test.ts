import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../../src/routes/leads/+page.svelte', import.meta.url), 'utf8');

test('Stage 8.8.12 performs a document navigation when filters are applied', () => {
  // IT: A full request guarantees that the visible list comes from the newly filtered server load.
  assert.match(page, /const submitted = new FormData\(submittedForm\);/);
  assert.match(page, /window\.location\.assign\(query \? `\/leads\?\$\{query\}` : '\/leads'\);/);
});

test('Stage 8.8.12 recalculates applied-filter state from changing page data', () => {
  // IT: Explicitly passing data makes the reactive dependency visible to the Svelte compiler.
  assert.match(page, /\$: activeFilterParts = buildActiveFilterParts\(data\);/);
  assert.match(page, /\$: currentFilterHref = buildCurrentFilterHref\(data\);/);
  assert.match(page, /function buildActiveFilterParts\(applied: any\)/);
  assert.match(page, /function buildCurrentFilterHref\(applied: any\)/);
});

test('Stage 8.8.12 shows Pin and Clear only after the server has applied a filter', () => {
  // IT: Both controls use the authoritative applied-filter state rather than unsaved form edits.
  assert.match(page, /\{#if hasActiveFilters\}[\s\S]{0,700}Pin current filter[\s\S]{0,300}Clear filters[\s\S]{0,100}\{\/if\}/);
  assert.match(page, /<a class="btn" href="\/leads" data-sveltekit-reload>Clear filters<\/a>/);
});
