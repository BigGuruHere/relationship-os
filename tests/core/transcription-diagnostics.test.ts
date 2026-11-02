import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { safeTranscriptionMetadata, validCorrelationId } from '../../src/lib/recording/transcriptionMetadata';
import { transcriptionEvent } from '../../src/lib/server/transcriptionDiagnostics';

test('transcription metadata drops content, secrets and arbitrary provider/browser text', () => {
  const unsafe = 'private@example.test';
  assert.deepEqual(safeTranscriptionMetadata({ transcript: unsafe, apiKey: unsafe, message: unsafe, stack: unsafe, mimeType: 'audio/webm;codecs='+unsafe, codec: unsafe, errorCategory: unsafe, audioBytes: -1, elapsedMs: Infinity }), {});
  assert.deepEqual(safeTranscriptionMetadata({ mimeType: 'audio/webm;codecs=opus', codec: 'opus', audioBytes: 123, emptyContent: false, characterCount: 3 }), { audioBytes: 123, characterCount: 3, emptyContent: false, mimeType: 'audio/webm;codecs=opus', codec: 'opus' });
  assert.deepEqual(safeTranscriptionMetadata({ provider: 'openai', model: 'whisper-1', requestId: 'req_fake', credentialsConfigured: true, externalCallAttempted: true }, true), {});
});
test('correlation IDs accept only random UUID format, never free text', () => {
  assert.equal(validCorrelationId(randomUUID()), true);
  for (const v of [undefined, 'someone@example.test', 'You', '../file', 'a'.repeat(1000)]) assert.equal(validCorrelationId(v), false);
});
test('debug gates detailed events, errors remain structured and redacted', () => {
  const previous = process.env.RELISH_TRANSCRIPTION_DEBUG;
  const log = console.log, error = console.error;
  const records: any[] = [];
  console.log = console.error = (value: string) => records.push(JSON.parse(value));
  try {
    const correlationId = randomUUID();
    delete process.env.RELISH_TRANSCRIPTION_DEBUG;
    transcriptionEvent('provider.result', correlationId, { characterCount: 3 });
    assert.equal(records.length, 0);
    transcriptionEvent('provider.error', correlationId, { errorCategory: 'network', transcript: 'private-content' }, true);
    assert.equal(records.length, 1);
    process.env.RELISH_TRANSCRIPTION_DEBUG = 'YES';
    transcriptionEvent('provider.result', correlationId, { characterCount: 3, transcript: 'private-content' });
    assert.equal(records.length, 2);assert.equal(records[1].correlationId, correlationId);assert.ok(records[1].timestamp);assert.equal(records[1].characterCount, 3);
    assert.ok(!JSON.stringify(records).includes('private-content'));
  } finally { console.log=log;console.error=error;if(previous===undefined)delete process.env.RELISH_TRANSCRIPTION_DEBUG;else process.env.RELISH_TRANSCRIPTION_DEBUG=previous; }
});
