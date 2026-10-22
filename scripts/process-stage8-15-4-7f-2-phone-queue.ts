// Stage 8.15.4.7f.2 - run as a separate worker process using the existing durable caller state.
// The webhook only queues work once the transcript has been stored. Never run this against
// production until a dedicated worker deployment, consent checks and retry policy are audited.
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { prisma } from '../src/lib/db';
import { runWithWorkspaceCustody } from '../src/lib/server/core/contextSpace';
import { processPhoneUnderstanding, finishPhoneUnderstanding } from '../src/lib/server/core/phoneUnderstandingAutomation';
import { CONVERSATION_TRANSCRIPT_CHANNEL, PERSON_CONVERSATION_SOURCE_CHANNEL } from '../src/lib/server/core/conversationIngestion';

// The worker inherits the application environment and its DATABASE_URL unchanged.
// Automatic learning remains explicitly opt-in in each deployed environment.
if (process.env.RELISH_PHONE_AUTO_LU !== 'YES') {
  throw new Error('RELISH_PHONE_AUTO_LU=YES is required for automatic processing.');
}

// One invocation can run continuously as a development-only worker, or once for diagnosis.
// The worker never logs participant identifiers, phone numbers, or conversation content.
const POLL_MS = 10_000;
const WATCH = process.argv.includes('--watch');
const ONCE = process.argv.includes('--once');
if (WATCH && ONCE) throw new Error('Choose either --watch or --once.');

// Work on one caller at a time. Atomic claim is safe across independently running workers.
async function runOne() {
  const candidates = await prisma.networkPhoneCaller.findMany({
    where: { understandingState: 'PROCESSING', understandingConversationId: { not: null } },
    orderBy: { understandingStateAt: 'asc' }, take: 20
  });
  for (const caller of candidates) {
    const conversationId = caller.understandingConversationId!;
    const claimed = await prisma.networkPhoneCaller.updateMany({
      where: { id: caller.id, understandingState: 'PROCESSING', understandingConversationId: conversationId },
      data: { understandingState: 'WORKING', understandingStateAt: new Date() }
    });
    if (claimed.count !== 1) continue;
    try {
      const digest = createHash('sha256').update(conversationId).digest('hex');
      const original = await prisma.interaction.findFirst({ where: {
        userId: caller.userId, contextSpaceId: caller.contextSpaceId,
        channel: CONVERSATION_TRANSCRIPT_CHANNEL, externalRef: `conversation:elevenlabs:${digest}`
      }, select: { id: true } });
      if (!original) throw new Error('Original transcript missing; intervention required.');
      const source = await prisma.interaction.findFirst({ where: {
        userId: caller.userId, contextSpaceId: caller.contextSpaceId, contactId: caller.contactId,
        channel: PERSON_CONVERSATION_SOURCE_CHANNEL,
        externalRef: `conversation:person-source:${original.id}:${caller.contactId}`
      }, select: { id: true } });
      if (!source) throw new Error('Participant source missing; intervention required.');
      const result = await runWithWorkspaceCustody(
        { userId: caller.userId, contextSpaceId: caller.contextSpaceId },
        () => processPhoneUnderstanding(
          { userId: caller.userId, contextSpaceId: caller.contextSpaceId, contactId: caller.contactId }, source.id));
      // Persist the outcome on the exact call, including successful NO_CHANGE runs.
      // Never report READY if recording the durable outcome fails.
      const outcome = result.detail === 'NO_CHANGE' ? 'NO_CHANGE' : 'APPLIED';
      await prisma.networkDorianSession.updateMany({
        where: { conversationId, userId: caller.userId, contextSpaceId: caller.contextSpaceId, contactId: caller.contactId },
        data: { understandingOutcome: outcome, understandingOutcomeAt: new Date() }
      });
      await finishPhoneUnderstanding(conversationId, 'READY');
      console.log('[Phone LU Worker] Completed', { status: result.status, detail: result.detail, outcome });
    } catch (error) {
      // Fail closed without exposing the conversation, identity, or sensitive transcript.
      await prisma.networkDorianSession.updateMany({
        where: { conversationId, userId: caller.userId, contextSpaceId: caller.contextSpaceId, contactId: caller.contactId },
        data: { understandingOutcome: 'FAILED', understandingOutcomeAt: new Date() }
      });
      await finishPhoneUnderstanding(conversationId, 'FAILED');
      // Safe diagnostic codes: never log provider messages, free-form error text,
      // transcript content, credentials, telephone numbers or person identifiers.
      const code = error && typeof error === 'object' && 'code' in error &&
        typeof error.code === 'string' ? error.code : 'UNCLASSIFIED';
      console.error('[Phone LU Worker] Processing failed - manual retry required', {
        conversationDigest: createHash('sha256').update(conversationId).digest('hex').slice(0, 12),
        errorClass: error instanceof Error ? error.name : 'UnknownError',
        errorCode: /^[A-Z0-9_]{1,24}$/.test(code) ? code : 'UNCLASSIFIED',
        state: 'FAILED'
      });
    }
    return true;
  }
  return false;
}

// Graceful shutdown: never interrupt an active processing request on a signal.
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

let previousBlockedSignature = '';
let lastBlockedReport = 0;
async function reportBlockedStates() {
  // These states must not silently time out to READY. That would expose stale
  // understanding after an unprocessed or missing conversation.
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const counts = await Promise.all(['IN_CALL', 'WORKING', 'FAILED'].map(state =>
    prisma.networkPhoneCaller.count({ where: { understandingState: state,
      understandingStateAt: { lt: cutoff } } })));
  // Report only a transition or one hourly reminder; never spam every poll.
  const signature = counts.join(':');
  const now = Date.now();
  if (signature !== previousBlockedSignature || (counts.some(Boolean) && now - lastBlockedReport >= 60 * 60 * 1000)) {
    previousBlockedSignature = signature;
    if (counts.some(Boolean)) {
      lastBlockedReport = now;
      const failures = counts[2] ? await prisma.networkPhoneCaller.findMany({
        where: { understandingState: 'FAILED', understandingStateAt: { lt: cutoff } },
        select: { understandingConversationId: true }, take: 10
      }) : [];
      console.warn('Phone understanding requires operator attention', {
        staleInCall: counts[0], staleWorking: counts[1], failedOlderThan15Minutes: counts[2],
        failedConversationDigests: failures.flatMap(row => row.understandingConversationId
          ? [createHash('sha256').update(row.understandingConversationId).digest('hex').slice(0, 12)] : [])
      });
    }
  }
}

try {
  do {
    // Drain outstanding queued records before sleeping to minimise callback delay.
    let processed = false;
    do {
      processed = await runOne();
    } while (WATCH && processed && !stopping);
    if (!WATCH) console.log(processed ? 'Processed one queued candidate.' : 'No queued candidates.');
    await reportBlockedStates();
    if (WATCH && !stopping) await sleep(POLL_MS);
  } while (WATCH && !stopping);
} finally {
  await prisma.$disconnect();
}

