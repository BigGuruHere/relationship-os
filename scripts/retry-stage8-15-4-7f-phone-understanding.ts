// Stage 8.15.4.7f: manually retry exactly one failed DEVELOPMENT phone understanding.
// This is intentionally not a general unlock command: a caller is released only after
// existing evidence passes the standard validated LU processing/approval workflow.
import { createHash } from 'node:crypto';
import { prisma } from '../src/lib/db';
import { runWithWorkspaceCustody } from '../src/lib/server/core/contextSpace';
import { processPhoneUnderstanding, finishPhoneUnderstanding } from '../src/lib/server/core/phoneUnderstandingAutomation';
import { CONVERSATION_TRANSCRIPT_CHANNEL, PERSON_CONVERSATION_SOURCE_CHANNEL } from '../src/lib/server/core/conversationIngestion';

if (process.env.RELISH_DB_ENV !== 'development' ||
    process.env.ALLOW_RELISH_PHONE_DEV_DB_TEST !== 'YES' ||
    process.env.NODE_ENV === 'production') {
  throw new Error('Only an explicitly authorised DEVELOPMENT retry is supported.');
}
const conversationId = String(process.env.RELISH_PHONE_RETRY_CONVERSATION_ID || '').trim();
if (!/^conv_[A-Za-z0-9_-]{8,100}$/.test(conversationId)) throw new Error('Provide one valid conversation ID.');

try {
  // Resolve one existing failed provisional caller. No caller or evidence records are created.
  const caller = await prisma.networkPhoneCaller.findFirst({
    where: { understandingConversationId: conversationId, understandingState: 'FAILED' }
  });
  if (!caller) throw new Error('No FAILED provisional processing state exists for that conversation.');
  const digest = createHash('sha256').update(conversationId).digest('hex');
  const original = await prisma.interaction.findFirst({ where: {
    userId: caller.userId, contextSpaceId: caller.contextSpaceId,
    channel: CONVERSATION_TRANSCRIPT_CHANNEL,
    externalRef: `conversation:elevenlabs:${digest}`
  }, select: { id: true } });
  if (!original) throw new Error('The original conversation has not been imported. Do not manually unlock this caller.');
  const source = await prisma.interaction.findFirst({ where: {
    userId: caller.userId, contextSpaceId: caller.contextSpaceId,
    contactId: caller.contactId, channel: PERSON_CONVERSATION_SOURCE_CHANNEL,
    externalRef: `conversation:person-source:${original.id}:${caller.contactId}`
  }, select: { id: true } });
  if (!source) throw new Error('Participant evidence has not been attached. No gate changes were made.');
  const result = await runWithWorkspaceCustody({userId:caller.userId,contextSpaceId:caller.contextSpaceId},
    () => processPhoneUnderstanding({userId:caller.userId,contextSpaceId:caller.contextSpaceId,contactId:caller.contactId},source.id));
  await finishPhoneUnderstanding(conversationId,'READY');
  console.log(`Recovered one DEVELOPMENT conversation: ${result.detail}. Caller ready.`);
} finally {
  await prisma.$disconnect();
}
