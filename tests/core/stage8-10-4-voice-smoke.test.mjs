// PURPOSE: Exercise the real Whisper request adapter with deterministic network responses.
// LIMIT: Browser microphone capture and the live OpenAI service require a separate manual smoke test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Set the test key before importing ai.ts because it captures the key during import.
process.env.OPENAI_API_KEY = 'voice-smoke-test-no-network';
const { transcribeAudio } = await import('../../src/lib/ai.ts');

test('Whisper adapter submits recorded bytes in multipart form and returns transcript', async () => {
  const oldFetch = globalThis.fetch;
  let requests = 0;
  try {
    globalThis.fetch = async (url, init) => {
      requests++;
      assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Authorization, 'Bearer voice-smoke-test-no-network');
      assert.equal(init.body.get('model'), 'whisper-1');
      assert.equal(init.body.get('response_format'), 'text');
      const uploaded = init.body.get('file');
      assert.equal(uploaded.name, 'audio.webm');
      assert.deepEqual(Buffer.from(await uploaded.arrayBuffer()), Buffer.from([26, 69, 223, 163, 1]));
      return new Response('  I enjoyed our conversation.  ', { status: 200 });
    };
    assert.equal(await transcribeAudio(Buffer.from([26, 69, 223, 163, 1])), 'I enjoyed our conversation.');
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('Whisper adapter preserves Safari MP4 container metadata', async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      const file = init.body.get('file');
      assert.equal(file.name, 'audio.mp4');
      assert.equal(file.type, 'audio/mp4');
      return new Response('Safari voice transcript', { status: 200 });
    };
    assert.equal(await transcribeAudio(Buffer.from([0, 0, 0, 24]), 'audio/mp4'), 'Safari voice transcript');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('Whisper adapter does not falsely report success on provider failure', async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('Simulated provider outage', { status: 503 });
    await assert.rejects(() => transcribeAudio(Buffer.from([1, 2, 3])), /OpenAI transcription failed: 503/);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('Dating voice UI uses Dating-scoped upload and polling paths', () => {
  // Wiring assertion only: unlike the adapter tests, this does not execute HTTP handlers.
  const ui = readFileSync('src/routes/dating/introductions/[id]/feedback/new/+page.svelte', 'utf8');
  assert.match(ui, /uploadEndpoint="\/dating\/api\/upload-chunk"/);
  assert.match(ui, /resultEndpoint="\/dating\/api\/transcribe-result"/);
  for (const [file, method] of [
    ['src/routes/dating/api/upload-chunk/+server.ts', 'POST'],
    ['src/routes/dating/api/transcribe-result/+server.ts', 'GET']
  ]) {
    const route = readFileSync(file, 'utf8');
    assert.match(route, /contextDomainKey !== 'dating'/);
    assert.match(route, /contextSpaceId/);
    assert.match(route, new RegExp(`export const ${method}: RequestHandler`));
  }
});

test('Database test disables keepalive and always closes Prisma', () => {
  const testSource = readFileSync('scripts/check-stage8-10-3-dating-db.ts', 'utf8');
  const dbSource = readFileSync('src/lib/db.ts', 'utf8');
  assert.match(testSource, /DB_KEEPALIVE_DISABLED = 'YES'/);
  assert.match(testSource, /await prisma\.\$disconnect\(\)/);
  assert.match(dbSource, /DB_KEEPALIVE_DISABLED !== 'YES'/);
  assert.match(dbSource, /__keepaliveIntervalId__\.unref\(\)/);
});
