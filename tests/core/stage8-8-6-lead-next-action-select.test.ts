// PURPOSE: Regression-test the Stage 8.8.6 Next Action control after HTML datalist proved unsuitable as a real selector.
// IT: Existing options must use a true select; free text is only exposed through an explicit create-new mode.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('src/routes/leads/[id]/+page.svelte', 'utf8');

test('quick Next Action uses a real select rather than a datalist text input', () => {
  assert.doesNotMatch(page, /<datalist[^>]*lead-next-action-options/);
  assert.match(page, /<select name="value" class="quick-select quick-action-select"/);
  assert.match(page, /on:change=\{handleQuickNextActionSelect\}/);
  assert.match(page, /<option value="__create__">\+ Create new action\.\.\.<\/option>/);
});

test('choosing an existing action autosaves through the existing quick-field form', () => {
  assert.match(page, /function handleQuickNextActionSelect\(event: Event\)[\s\S]*submitQuickControl\(event\);/);
  assert.match(page, /action="\?\/quickField"[\s\S]*use:enhance=\{enhanceQuickField\('nextAction'\)\}/);
});

test('create-new mode keeps free typing available without submitting the sentinel', () => {
  assert.match(page, /select\.value === '__create__'/);
  assert.match(page, /quickNextActionCreating = true/);
  assert.match(page, /placeholder="Type a new next action"/);
  assert.match(page, /cancelQuickNextActionCreate/);
});

test('a newly saved custom action is added to the in-page options immediately', () => {
  assert.match(page, /ensureNextActionOption\(saved\)/);
  assert.match(page, /nextActionOptions = \[\.\.\.nextActionOptions, value\]/);
});

test('full Edit Lead uses the same select plus explicit create-new mode', () => {
  assert.match(page, /editNextActionCreating/);
  assert.match(page, /<select id="nextAction" name="nextAction"/);
  assert.match(page, /handleEditNextActionSelect/);
  assert.match(page, /Use existing action/);
});

test('Stage 8.8.6 is code-only and adds no migration after the 8.8.5 taxonomy migration', () => {
  const migrations = fs.readdirSync('prisma/migrations').filter((name) => /^\d/.test(name)).sort();
  assert.equal(migrations.at(-1), '20260907144000_stage8_8_5_lead_next_action_options');
});
