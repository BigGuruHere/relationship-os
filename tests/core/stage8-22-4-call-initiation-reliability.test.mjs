// Stage 8.22.4: executable provider-facing contract and continuity policy tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { finishDorianInitiationData, initiationContractDiagnostics } from '../../src/lib/server/integrations/elevenlabs/voiceInitiationContract.mjs';
import { continuityHoldReason } from '../../src/lib/server/core/phoneAdmissionPolicy.mjs';
import { scheduleNonblockingTask } from '../../src/lib/server/core/nonblockingAfterResponse.mjs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const token = 'A'.repeat(43); // Test-only dummy credential; never a real Relish token.
const envelope = (value, extra = {}) => ({
  type: 'conversation_initiation_client_data',
  dynamic_variables: { relish_network_session: value, call_instruction: 'Test consent first', ...extra }
});

test('valid participant response satisfies required tool and compatibility variables', () => {
  const result = finishDorianInitiationData(envelope(token), 'PARTICIPANT');
  assert.equal(result.dynamic_variables.relish_network_session, token);
  for (const key of ['call_instruction', 'memory_and_identity_context', 'call_type', 'user_name',
    'previous_calls', 'last_call_summary', 'emotion_label', 'agent_website', 'agent_type',
    'relish_terms_status', 'relish_terms_sms_status']) {
    assert.equal(typeof result.dynamic_variables[key], 'string', key);
  }
  assert.deepEqual(initiationContractDiagnostics(result), {
    hasSessionVariable: true, hasCallInstruction: true, allVariablesScalar: true
  });
});

test('valid browser response requires a server-issued participant session', () => {
  assert.equal(finishDorianInitiationData(envelope(token), 'BROWSER').dynamic_variables.relish_network_session, token);
  assert.throws(() => finishDorianInitiationData(envelope('PROCESSING_NO_SESSION'), 'BROWSER'));
});

test('processing-only and unresolved returns never issue an authorised tool credential', () => {
  for (const [mode, sentinel] of [
    ['PROCESSING_ONLY','PROCESSING_NO_SESSION'], ['UNRESOLVED','UNRESOLVED_NO_SESSION']
  ]) {
    const result = finishDorianInitiationData(envelope(sentinel), mode);
    assert.equal(result.dynamic_variables.relish_network_session, sentinel);
    assert.throws(() => finishDorianInitiationData(envelope(token), mode));
  }
});

test('missing, empty, object or sentinel tokens fail closed for participants', () => {
  for (const value of [undefined, null, '', 'missing', 'PROCESSING_NO_SESSION', {}, 6]) {
    assert.throws(() => finishDorianInitiationData(envelope(value), 'PARTICIPANT'));
  }
  assert.throws(() => finishDorianInitiationData({ type: 'bad', dynamic_variables: {} }, 'PARTICIPANT'));
});

test('a malformed dynamic variable fails before the HTTP response', () => {
  assert.throws(() => finishDorianInitiationData(envelope(token, { invalid: ['no'] }), 'PARTICIPANT'));
  assert.throws(() => finishDorianInitiationData(envelope(token, { invalid: null }), 'PARTICIPANT'));
});

test('a started or failed telephone attempt cannot hold continuity', () => {
  for (const state of ['READY','IN_CALL','FAILED','EXPIRED','STARTED','NOT_REQUIRED',null]) {
    assert.equal(continuityHoldReason(state), null, String(state));
  }
  assert.equal(continuityHoldReason('PROCESSING'), 'UNDERSTANDING_PENDING');
  assert.equal(continuityHoldReason('WORKING'), 'UNDERSTANDING_PENDING');
  assert.equal(continuityHoldReason('AWAITING_INGEST'), 'TRANSCRIPT_INGEST_PENDING');
});

test('initiation has no external Telnyx or Agent Management refresh wait', () => {
  // Supplemental wiring check; the contract tests above execute the actual pure validators.
  const initiation = read('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
  assert.doesNotMatch(initiation, /await dispatchCurrentPolicySms/);
  assert.doesNotMatch(initiation, /await fetchPublishedDorianConfig/);
  assert.match(initiation, /await enqueueCurrentPolicySms/);
  assert.match(initiation, /readPublishedDorianConfigSnapshot/);
  assert.match(initiation, /finishDorianInitiationData\(payload, mode\)/);
  assert.match(initiation, /elapsedMs/);
});

test('participant-session creation never claims IN_CALL', () => {
  const admission = read('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts');
  const start = admission.indexOf("const token = randomBytes(32)");
  const end = admission.indexOf("return { status: 'READY' as const", start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(admission.slice(start, end), /understandingState: 'IN_CALL'/);
  assert.match(admission.slice(start, end), /networkDorianSession\.create/);
  const understanding = read('src/lib/server/core/phoneUnderstandingAutomation.ts');
  assert.match(understanding, /call\?\.callState !== 'ENDED'/);
  assert.match(understanding, /understandingState: 'PROCESSING'/);
});

test('SMS delivery and retry are separate from fast initiation', () => {
  const sms = read('src/lib/server/core/relishPolicySms.ts');
  const worker = read('scripts/process-stage8-15-4-7f-2-phone-queue.ts');
  const enqStart = sms.indexOf('export async function enqueueCurrentPolicySms(');
  const enqEnd = sms.indexOf('export async function drainQueuedPolicySms(', enqStart);
  assert.doesNotMatch(sms.slice(enqStart, enqEnd), /sendTelnyxSms/);
  assert.match(sms.slice(enqEnd), /await sendTelnyxSms/);
  assert.match(worker, /drainQueuedPolicySms\(10\)/);
});


test('a slow or failing SMS task cannot delay the prepared initiation response', async () => {
  let release;
  const neverFastProvider = new Promise(resolve => { release = resolve; });
  let taskStarted = false;
  scheduleNonblockingTask(async () => {
    taskStarted = true;
    await neverFastProvider;
    throw new Error('simulated provider outage');
  }, () => {});
  // The same event-loop turn can return a validated HTTP envelope immediately,
  // without waiting for the delayed/failing provider task.
  const prepared = finishDorianInitiationData(envelope(token), 'PARTICIPANT');
  assert.equal(prepared.dynamic_variables.relish_network_session, token);
  assert.equal(taskStarted, false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(taskStarted, true);
  release();
});


test('processing-only greeting never reads name from the WAIT result', () => {
  // A WAIT projection only includes status and reason. It does not have a
  // preferredName and must not read private context while a call is blocked.
  const handler = read('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
  const waitStart = handler.indexOf("if (prepared.status === 'WAIT')");
  const waitEnd = handler.indexOf("mode: 'PARTICIPANT'", waitStart);
  assert.ok(waitStart !== -1 && waitEnd > waitStart);
  const waitBranch = handler.slice(waitStart, waitEnd);
  assert.doesNotMatch(waitBranch, /prepared\.preferredName/);
  assert.match(waitBranch, /user_name: ''/);
  assert.match(waitBranch, /const waitingMessage = "Hi there\./);
});
