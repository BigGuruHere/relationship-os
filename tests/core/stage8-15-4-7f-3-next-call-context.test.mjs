// Structural guardrail: verify provisional telephone memory uses existing authoritative LU custody.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/lib/server/integrations/elevenlabs/phoneOnboarding.ts', import.meta.url), 'utf8');
test('private LU retrieval requires explicit pilot opt-in', () => {
  assert.match(source, /RELISH_PHONE_LU_CONTEXT === 'YES'/);
  assert.match(source, /phoneLivingContextEnabled\(\) && previousCalls > 0/);
});
test('existing authoritative LU is read inside caller custody', () => {
  assert.match(source, /runWithWorkspaceCustody\(/);
  assert.match(source, /getCurrentLivingUnderstanding\(/);
  assert.match(source, /contactId: selected\.contactId/);
});
test('bounded memory is passed to existing ElevenLabs dynamic variables', () => {
  assert.match(source, /\.slice\(0, 12\)/);
  assert.match(source, /\.slice\(0, 6000\)/);
  assert.match(source, /living_understanding: input\.livingContext/);
  assert.match(source, /living_understanding_revision: input\.livingRevision/);
});
test('retrieval error does not provide a session token', () => {
  assert.match(source, /catch \{[\s\S]*?return \{ status: 'WAIT' as const, preferredName \};/);
});
