// PURPOSE: Verify Stage 8.8.2 lead working-list navigation and preserved filter behaviour.
// SECURITY: Return targets must stay on the Leads list route and cannot become open redirects.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildLeadDetailHref, buildLeadDetailReturnUrl, buildLeadListReturnHref, safeLeadListReturnTo } from '../../src/lib/leadListNavigation.ts';

test('filtered lead-list URLs are preserved when opening a lead', () => {
  const listHref = '/leads?source=custom%3Abatch-123&q=aged+care&status=NEW';
  const href = buildLeadDetailHref('lead-1', listHref);

  assert.equal(
    href,
    '/leads/lead-1?returnTo=%2Fleads%3Fsource%3Dcustom%253Abatch-123%26q%3Daged%2Bcare%26status%3DNEW'
  );
  assert.equal(safeLeadListReturnTo(listHref), listHref);
  assert.equal(buildLeadListReturnHref(listHref), `${listHref}#lead-list`);
});

test('lead-list return targets fail closed outside the Leads list', () => {
  assert.equal(safeLeadListReturnTo('https://example.com'), '/leads');
  assert.equal(safeLeadListReturnTo('//example.com/leads'), '/leads');
  assert.equal(safeLeadListReturnTo('/contacts'), '/leads');
  assert.equal(safeLeadListReturnTo('/leads/lead-1'), '/leads');
  assert.equal(buildLeadDetailReturnUrl('lead-1', '/contacts'), '/leads/lead-1?returnTo=%2Fleads');
});

test('priority quick control is rendered only in the existing Details priority row', () => {
  const source = fs.readFileSync('src/routes/leads/[id]/+page.svelte', 'utf8');
  assert.equal((source.match(/action="\?\/quickPriority"/g) || []).length, 1);
  assert.match(source, /<strong>Priority<\/strong><div class="priority-inline-wrap">/);
  assert.doesNotMatch(source, /priority-quick-row/);
});

test('lead list passes its exact current URL into detail navigation', () => {
  const listSource = fs.readFileSync('src/routes/leads/+page.svelte', 'utf8');
  const serverSource = fs.readFileSync('src/routes/leads/+page.server.ts', 'utf8');
  const detailSource = fs.readFileSync('src/routes/leads/[id]/+page.svelte', 'utf8');

  assert.match(serverSource, /currentPath: `\$\{url\.pathname\}\$\{url\.search\}`/);
  assert.match(listSource, /buildLeadDetailHref\(lead\.id, data\.currentPath \|\| '\/leads'\)/);
  assert.match(detailSource, /buildLeadListReturnHref\(data\.returnTo\)/);
  assert.match(detailSource, />Return to list<\/a>/);
  assert.match(listSource, /class="lead-list" id="lead-list"/);
});
