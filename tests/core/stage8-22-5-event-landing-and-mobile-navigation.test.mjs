// Stage 8.22.5 - Guard the event QR switch, stored opt-in and mobile dropdown closure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = relative => readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');
test('original profile remains and guest business QR routes to event page', () => {
  const profile = read('src/routes/u/[slug]/+page.server.ts');
  assert.match(profile, /profile\.kind === 'business'/);
  assert.match(profile, /RELISH_EVENT_LANDING_ENABLED/);
  assert.match(profile, /RELISH_EVENT_PROFILE_SLUG/);
  assert.match(profile, /original=1/);
  assert.match(profile, /throw redirect\(307/);
  assert.match(read('src/routes/u/[slug]/+page.svelte'), /Meet Dorian/);
});
test('event form requires explicit opt-in and one usable contact channel', () => {
  const code = read('src/routes/u/[slug]/event/+page.server.ts');
  assert.match(code, /pilotContactConsent/);
  assert.match(code, /\(!email && !phone\)/);
  assert.match(code, /profile\.kind !== 'business'/);
  assert.match(code, /encrypt\(name/);
  assert.match(code, /buildScopedIndexToken/);
  assert.match(code, /relishEventPilotSignup\.upsert/);
});
test('event signup model is separate from Contact and persists consent and group', () => {
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /model RelishEventPilotSignup/);
  assert.match(schema, /consentAt DateTime/);
  assert.match(schema, /interestGroup String/);
  assert.match(read('src/routes/event-signups/+page.server.ts'), /ownerUserId: locals\.user\.id/);
});
test('mobile more menu closes on click and navigation', () => {
  const shell = read('src/routes/+layout.svelte');
  assert.match(shell, /bind:open=\{moreMenuOpen\}/);
  assert.match(shell, /afterNavigate\(closeMoreMenu\)/);
  assert.match(shell, /on:click=\{closeMoreMenu\}>Relish home/);
  assert.match(shell, /on:click=\{closeMoreMenu\}>Operator tools/);
});
