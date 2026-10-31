// Stage 8.22.3c: a provider-independent call exists even without a participant session.
// The ledger records lifecycle metadata only; phone numbers and transcript content stay outside it.
import { prisma } from '$lib/db';

const validConversationId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{7,119}$/.test(value);

export type DorianCallMode = 'PARTICIPANT' | 'PROCESSING_ONLY' | 'UNRESOLVED';

export async function recordDorianCallInitiation(input: {
  conversationId: unknown; callerId?: string | null; bindingId?: string | null; mode: DorianCallMode;
}) {
  if (!validConversationId(input.conversationId)) return;
  // Upsert is idempotent for repeated initiation webhooks. No phone or credential is persisted.
  await prisma.dorianVoiceCallLifecycle.upsert({
    where: { conversationId: input.conversationId },
    create: { conversationId: input.conversationId, callerId: input.callerId || null,
      agentBindingId: input.bindingId || null, mode: input.mode },
    update: { /* Never revert a completed call or replace its original classification. */ }
  });
}

export async function completeDorianCall(conversationId: unknown, hasParticipantSpeech: boolean, endedAt = new Date()) {
  if (!validConversationId(conversationId)) return;
  // Only a verified provider completion event closes the call. No provider API GET is required.
  // A blocked call closes normally but never queues an LU job.
  await prisma.dorianVoiceCallLifecycle.updateMany({
    where: { conversationId, callState: { in: ['STARTED', 'UNCONFIRMED'] } },
    data: { callState: 'ENDED', endedAt,
      // Speech creates a *pending* Relish understanding job, never a completed one.
      // Processing-only or unresolved calls cannot queue LU.
      ...(hasParticipantSpeech ? {} : { understandingState: 'NOT_REQUIRED' }) }
  });
  if (hasParticipantSpeech) {
    await prisma.dorianVoiceCallLifecycle.updateMany({
      where: { conversationId, mode: 'PARTICIPANT', callState: 'ENDED',
        understandingState: 'NOT_REQUIRED' },
      data: { understandingState: 'PENDING' }
    });
  }
}

export async function setDorianCallUnderstanding(conversationId: string,
  state: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED') {
  if (!validConversationId(conversationId)) return;
  // Only a participant call can have LU. Terminal outcomes cannot be reopened
  // by a duplicate post-call webhook or a delayed worker callback.
  // FAILED also permits an initiation failure before the LU job was queued.
  const eligiblePriorStates = state === 'PENDING' ? ['PENDING']
    : state === 'PROCESSING' ? ['PENDING', 'PROCESSING']
    : state === 'FAILED' ? ['NOT_REQUIRED', 'PENDING', 'PROCESSING']
    : ['PENDING', 'PROCESSING'];
  await prisma.dorianVoiceCallLifecycle.updateMany({
    where: { conversationId, mode: 'PARTICIPANT',
      understandingState: { in: eligiblePriorStates } },
    data: { understandingState: state }
  });
}

export async function expireDorianCallUnderstanding(conversationId: string) {
  if (!validConversationId(conversationId)) return;
  await prisma.dorianVoiceCallLifecycle.updateMany({
    where: { conversationId, mode: 'PARTICIPANT', understandingState: { in: ['PENDING', 'PROCESSING'] } },
    data: { understandingState: 'EXPIRED' }
  });
}
