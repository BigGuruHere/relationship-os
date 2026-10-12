// Stage 8.14.2.1 - Development observability for ElevenLabs initiation and post-call bridge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const debug = read('../../src/lib/server/integrations/elevenlabs/debug.ts');
const initiationRoute = read('../../src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
const postCallRoute = read('../../src/routes/api/webhooks/elevenlabs/+server.ts');

test('ElevenLabs debug logging is explicit opt-in and credentials are redacted', () => {
  assert.match(debug, /ELEVENLABS_DEBUG_LOGGING/);
  assert.match(debug, /ELEVENLABS_DEBUG_LOG_PAYLOADS/);
  assert.match(debug, /\[REDACTED\]/);
  assert.match(debug, /authorization/);
  assert.match(debug, /signature/);
  assert.match(debug, /secret/);
});

test('initiation bridge logs request, auth, deployment, identity, custody and response', () => {
  for (const phase of ['REQUEST', 'AUTH', 'RECEIVED', 'AGENT', 'CUSTODY', 'IDENTITY', 'RESPONSE', 'SENT']) {
    assert.match(initiationRoute, new RegExp(`'${phase}'`));
  }
  assert.match(initiationRoute, /Full initiation payload received from ElevenLabs/);
  assert.match(initiationRoute, /Full initiation response sent to ElevenLabs/);
  assert.doesNotMatch(initiationRoute, /console\.log\([^\n]*authorization/i);
});

test('post-call bridge logs signature, raw event summary, normalized transcript, storage and participant attachment', () => {
  for (const phase of ['REQUEST', 'AUTH', 'RECEIVED', 'NORMALIZE', 'AGENT', 'CUSTODY', 'STORE', 'IDENTITY', 'ATTACH', 'RESPONSE', 'SENT']) {
    assert.match(postCallRoute, new RegExp(`'${phase}'`));
  }
  assert.match(postCallRoute, /Full signed post-call payload received from ElevenLabs/);
  assert.match(postCallRoute, /Normalized transcript and metadata/);
  assert.match(postCallRoute, /Participant-specific conversation evidence attached/);
});
