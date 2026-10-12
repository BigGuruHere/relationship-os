import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/server/core/contextSpace.ts', 'utf8');

test('ElevenLabs ingest boundary permits only read access needed for LU handoff', () => {
  const match = source.match(/ELEVENLABS_CONVERSATION_INGEST:\s*\{\s*models:\s*\{([\s\S]*?)\n\s*\}\s*\},\s*ELEVENLABS_CONVERSATION_INITIATION/);
  assert.ok(match, 'ingest policy block should exist');
  const block = match[1];
  assert.match(block, /LivingUnderstandingRevision:\s*new Set\(\['findFirst'\]\)/);
  assert.match(block, /LivingUnderstandingRevisionSource:\s*new Set\(\['findFirst'\]\)/);
  assert.doesNotMatch(block, /LivingUnderstandingRevision:\s*new Set\([^)]*(create|update|delete)/);
  assert.doesNotMatch(block, /LivingUnderstandingRevisionSource:\s*new Set\([^)]*(create|update|delete)/);
});
