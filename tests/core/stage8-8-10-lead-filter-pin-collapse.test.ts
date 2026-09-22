import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../../src/routes/leads/+page.svelte', import.meta.url), 'utf8');

test('Stage 8.8.10 only shows the pin control after a filter is applied', () => {
  // IT: Keep the unfiltered Lead list uncluttered; pinning is relevant only once an applied filter exists.
  assert.match(page, /\{#if hasActiveFilters\}[\s\S]{0,400}Pin current filter[\s\S]{0,250}\{\/if\}/);
  assert.match(page, /disabled=\{currentFilterIsPinned\}/);
  assert.doesNotMatch(page, /disabled=\{!hasActiveFilters \|\| currentFilterIsPinned\}/);
});

test('Stage 8.8.10 collapses the filter panel when Apply filters is submitted', () => {
  // IT: Same-route GET navigation can preserve component state, so the submit handler still collapses explicitly.
  assert.match(page, /(?:async )?function applyFilters\(event: SubmitEvent\) \{[\s\S]{0,120}filtersExpanded = false;/);
  assert.match(page, /<form method="GET" class="filter-row" on:submit=\{applyFilters\}>/);
  assert.match(page, /<button class="btn primary" type="submit">Apply filters<\/button>/);
});
