// Stage 8.15.4.7f.2 - run as a separate worker process using the existing durable caller state.
// The webhook only queues work once the transcript has been stored. Never run this against
// production until a dedicated worker deployment, consent checks and retry policy are audited.
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { prisma } from '../src/lib/db';
import { runWithWorkspaceCustody } from '../src/lib/server/core/contextSpace';
import { processPhoneUnderstanding, finishPhoneUnderstanding } from '../src/lib/server/core/phoneUnderstandingAutomation';
import { CONVERSATION_TRANSCRIPT_CHANNEL, PERSON_CONVERSATION_SOURCE_CHANNEL } from '../src/lib/server/core/conversationIngestion';

if (process.env.RELISH_DB_ENV !== 'development' || process.env.ALLOW_RELISH_PHONE_DEV_DB_TEST !== 'YES' || process.env.NODE_ENV === 'production') {
  throw new Error('Worker is DEVELOPMENT-only until the production recovery policy is verified.');
}
if (process.env.RELISH_PHONE_AUTO_LU !== 'YES') throw new Error('RELISH_PHONE_AUTO_LU=YES is required.');

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
      await finishPhoneUnderstanding(conversationId, 'READY');
      console.log('Phone LU processing completed', { status: result.status, detail: result.detail });
    } catch (error) {
      // Fail closed without exposing the conversation, identity, or sensitive transcript.
      await finishPhoneUnderstanding(conversationId, 'FAILED');
      console.error('Phone LU processing failed; manual review required',
        error instanceof Error ? error.name : 'UnknownError');
    }
    return true;
  }
  return false;
}

// Graceful shutdown: never interrupt an active processing request on a signal.
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

async function reportBlockedStates() {
  // These states must not silently time out to READY. That would expose stale
  // understanding after an unprocessed or missing conversation.
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const counts = await Promise.all(['IN_CALL', 'WORKING', 'FAILED'].map(state =>
    prisma.networkPhoneCaller.count({ where: { understandingState: state,
      understandingStateAt: { lt: cutoff } } })));
  if (counts.some(Boolean)) console.warn('Phone understanding requires operator attention', {
    staleInCall: counts[0], staleWorking: counts[1], failedOlderThan15Minutes: counts[2]
  });
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

