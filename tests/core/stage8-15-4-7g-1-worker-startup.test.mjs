// Stage 8.15.4.7g.1: source contract checks without live database writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
test('startup couples web and opt-in worker using inherited environment', () => {
  const pkg = JSON.parse(read('package.json'));
  const start = read('scripts/start-relish.mjs');
  assert.match(pkg.scripts.dev, /start-relish/);
  assert.match(pkg.scripts['start:with-migrations'], /start-relish/);
  assert.match(start, /RELISH_PHONE_AUTO_LU === 'YES'/);
  assert.match(start, /env: process.env/g);
  assert.match(start, /process-stage8-15-4-7f-2-phone-queue/);
});
test('worker retains atomic claim and redacted diagnostics', () => {
  const worker = read('scripts/process-stage8-15-4-7f-2-phone-queue.ts');
  assert.match(worker, /understandingState: 'PROCESSING'/);
  assert.match(worker, /understandingState: 'WORKING'/);
  assert.match(worker, /conversationDigest/);
  assert.doesNotMatch(worker, /console\.error\([^\n]*error\.message/);
});
test('provisional greetings no longer say welcome back to Dorian', () => {
  const phone = read('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts');
  assert.match(phone, /Dorian Kreed, your AI conversation partner/);
  assert.match(phone, /May I ask who is calling/);
  assert.doesNotMatch(phone, /welcome back to Dorian/i);
  assert.match(phone, /relish_network_session: input\.token/);
});
