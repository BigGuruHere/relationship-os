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
  assert.doesNotMatch(guard, /rg-content[^>]*on:click/);
  assert.doesNotMatch(guard, /rg-content[^>]*on:pointerdown/);
});

test('8.14.0.4 removes the exact unused selectors reported by svelte-check', () => {
  const layout = read('src/routes/+layout.svelte');
  const profile = read('src/routes/settings/profile/+page.svelte');
  const publicProfile = read('src/routes/u/[slug]/+page.svelte');
  assert.doesNotMatch(layout, /\n\s*\.icon-btn\s*\{/);
  assert.doesNotMatch(profile, /\n\s*\.note \{/);
  assert.doesNotMatch(publicProfile, /\.topbar \.note/);
});

test('8.14.0.4 intentionally consumes the RelationshipIntelligencePanel contact id prop', () => {
  const panel = read('src/lib/RelationshipIntelligencePanel.svelte');
  assert.match(panel, /data-contact-id=\{contactId \|\| undefined\}/);
});
