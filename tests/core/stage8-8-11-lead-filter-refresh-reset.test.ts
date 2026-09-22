import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../../src/routes/leads/+page.svelte', import.meta.url), 'utf8');

test('Stage 8.8.11 applies Lead filters through immediate navigation', () => {
  // IT: Explicit navigation avoids stale results when SvelteKit reuses the same page component for query-string changes.
  assert.match(page, /function applyFilters\(event: SubmitEvent\)/);
  assert.match(page, /event\.preventDefault\(\);/);
  assert.match(page, /window\.location\.assign\(query \? `\/leads\?\$\{query\}` : '\/leads'\);/);
  assert.match(page, /<form method="GET" class="filter-row" on:submit=\{applyFilters\}>/);
});

test('Stage 8.8.11 keeps a one-click reset control with applied filters', () => {
  // IT: The reset control shares the applied-filter guard with Pin and returns to the unfiltered Lead route.
  assert.match(page, /\{#if hasActiveFilters\}[\s\S]{0,700}(?:Reset|Clear) filters[\s\S]{0,100}\{\/if\}/);
  assert.match(page, /href="\/leads" data-sveltekit-reload>Clear filters<\/a>/);
});

test('Stage 8.8.11 keeps filter controls aligned with the server-applied URL', () => {
  // IT: Query navigation can retain local component variables, so the current server path is the synchronization boundary.
  assert.match(page, /\$: if \(data\.currentPath !== syncedFilterPath\)/);
  assert.match(page, /syncedFilterPath = data\.currentPath;/);
  assert.match(page, /workstreamId = data\.selectedWorkstreamId \|\| '';/);
});
