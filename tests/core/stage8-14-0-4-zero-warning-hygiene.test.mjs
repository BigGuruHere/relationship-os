import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

test('8.14.0.4 closes the remaining initial-route and Living Understanding check errors', () => {
  const lu = read('src/lib/server/datingLivingUnderstanding.ts');
  const initial = read('src/routes/dating/people/[id]/understanding/initial/+page.server.ts');
  assert.match(lu, /type ReviewRow = \{ id: string; rawTextEnc: string; occurredAt: Date \}/);
  assert.match(lu, /map\(\(row: ReviewRow\)/);
  assert.match(initial, /sharedActions as unknown as Actions/);
});

test('8.14.0.4 removes the reported accessibility and autofocus warnings without disabling interaction', () => {
  const guard = read('src/lib/recording/RecordingGuard.svelte');
  const lead = read('src/routes/leads/[id]/+page.svelte');
  assert.doesNotMatch(guard, /rg-content[^>]*on:click/);
  assert.doesNotMatch(guard, /rg-content[^>]*on:pointerdown/);
  assert.doesNotMatch(lead, /\sautofocus(?:\s|\/?>)/);
  assert.match(lead, /use:focusOnMount/);
});

test('8.14.0.4 removes the exact unused selectors reported by svelte-check', () => {
  const files = {
    tasksPanel: read('src/lib/TasksPanel.svelte'),
    layout: read('src/routes/+layout.svelte'),
    interaction: read('src/routes/contacts/[id]/interactions/[iid]/+page.svelte'),
    dealEdit: read('src/routes/deals/[id]/edit/+page.svelte'),
    dealNew: read('src/routes/deals/new/+page.svelte'),
    leads: read('src/routes/leads/+page.svelte'),
    offers: read('src/routes/offers/[id]/+page.svelte'),
    project: read('src/routes/projects/[id]/+page.svelte'),
    workstream: read('src/routes/projects/[id]/workstreams/[workstreamId]/+page.svelte'),
    profile: read('src/routes/settings/profile/+page.svelte'),
    taskEdit: read('src/routes/tasks/[id]/edit/+page.svelte'),
    publicProfile: read('src/routes/u/[slug]/+page.svelte'),
    wants: read('src/routes/wants/[id]/+page.svelte')
  };
  assert.doesNotMatch(files.tasksPanel, /\.field input, \.field select, \.field textarea/);
  assert.doesNotMatch(files.layout, /\n\s*\.icon-btn\s*\{/);
  assert.doesNotMatch(files.interaction, /\.area,\.field input,/);
  assert.doesNotMatch(files.dealEdit, /\n\s*textarea \{ resize: vertical; \}/);
  assert.doesNotMatch(files.dealNew, /\n\s*textarea \{ resize: vertical; \}/);
  assert.doesNotMatch(files.leads, /\.grid\.four/);
  for (const key of ['offers', 'wants']) {
    assert.doesNotMatch(files[key], /\.note-head/);
    assert.doesNotMatch(files[key], /\.actions/);
    assert.doesNotMatch(files[key], /\.preline/);
    assert.doesNotMatch(files[key], /\.note-card/);
  }
  assert.doesNotMatch(files.project, /\.mini-list/);
  assert.doesNotMatch(files.project, /\.mini-row/);
  assert.doesNotMatch(files.workstream, /\.btn\.danger/);
  assert.doesNotMatch(files.profile, /\n\s*\.note \{/);
  assert.doesNotMatch(files.taskEdit, /\.grid\.four/);
  assert.doesNotMatch(files.publicProfile, /\.topbar \.note/);
});

test('8.14.0.4 intentionally consumes the RelationshipIntelligencePanel contact id prop', () => {
  const panel = read('src/lib/RelationshipIntelligencePanel.svelte');
  assert.match(panel, /data-contact-id=\{contactId \|\| undefined\}/);
});
