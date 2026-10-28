// Stage 8.20.1: authorised Dorian call recovery. Only operator-owned ElevenLabs bindings
// are addressable. Never read or log raw transcripts, phone numbers or LU contents.
// This service never creates or applies a Living Understanding revision itself.
import { createHash } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { CONVERSATION_TRANSCRIPT_CHANNEL, PERSON_CONVERSATION_SOURCE_CHANNEL } from '$lib/server/core/conversationIngestion';
import { recoveryEligibility, type RecoveryOperation } from './dorianRecoveryPolicy';

type Viewer = { userId: string; contextSpaceId: string };
const REASONS = new Set(['PROVIDER_CALL_ENDED', 'PROCESSING_STALLED', 'WORKER_STOPPED', 'SKIP_UNRECOVERABLE']);

function conflict(): never { throw error(409, 'This call changed since the monitor was loaded. Refresh before retrying.'); }

async function ownedBindings(viewer: Viewer) {
  return prisma.agentProviderBinding.findMany({
    where: { userId: viewer.userId, contextSpaceId: viewer.contextSpaceId, provider: 'ELEVENLABS' },
    select: { id: true }
  });
}

// The worker uses these exact digest-based source indexes. Checking existence does
// not decrypt or expose the participant's conversation, nor assume a null outcome
// represents a valid completed call.
async function evidenceExists(tx: Pick<typeof prisma, 'interaction'>, session: {
  conversationId: string | null; userId: string; contextSpaceId: string; contactId: string
}): Promise<boolean> {
  if (!session.conversationId) return false;
  const digest = createHash('sha256').update(session.conversationId).digest('hex');
  const original = await tx.interaction.findFirst({ where: {
    userId: session.userId, contextSpaceId: session.contextSpaceId,
    channel: CONVERSATION_TRANSCRIPT_CHANNEL, externalRef: `conversation:elevenlabs:${digest}`
  }, select: { id: true } });
  if (!original) return false;
  return Boolean(await tx.interaction.findFirst({ where: {
    userId: session.userId, contextSpaceId: session.contextSpaceId,
    contactId: session.contactId, channel: PERSON_CONVERSATION_SOURCE_CHANNEL,
    externalRef: `conversation:person-source:${original.id}:${session.contactId}`
  }, select: { id: true } }));
}

export async function listDorianRecovery(viewer: Viewer) {
  const bindings = (await ownedBindings(viewer)).map(row => row.id);
  if (!bindings.length) return { items: [], events: [] };
  const sessions = await prisma.networkDorianSession.findMany({
    where: { agentBindingId: { in: bindings }, conversationId: { not: null } },
    select: { id: true, agentBindingId: true, userId: true, contextSpaceId: true, contactId: true,
      conversationId: true, createdAt: true, expiresAt: true, pilotEntryId: true,
      understandingOutcome: true, understandingOutcomeAt: true },
    orderBy: { createdAt: 'desc' }, take: 350
  });
  const callers = await prisma.networkPhoneCaller.findMany({
    where: { userId: { in: [...new Set(sessions.map(s => s.userId))] }, understandingState: { not: 'READY' } },
    select: { userId: true, understandingState: true, understandingStateAt: true, understandingConversationId: true }
  });
  const callersByUser = new Map(callers.map(c => [c.userId, c]));
  const now = Date.now();
  const candidates = sessions.filter(s => {
    if (s.pilotEntryId) return ['QUEUED', 'WORKING', 'FAILED'].includes(s.understandingOutcome || '');
    const c = callersByUser.get(s.userId);
    return c?.understandingConversationId === s.conversationId &&
      ['IN_CALL', 'PROCESSING', 'WORKING', 'FAILED'].includes(c.understandingState);
  }).slice(0, 50);
  const items = [];
  for (const session of candidates) {
    const caller = !session.pilotEntryId ? callersByUser.get(session.userId) : null;
    const state = session.pilotEntryId ? session.understandingOutcome! : caller!.understandingState;
    const changedAt = session.pilotEntryId ? session.understandingOutcomeAt : caller?.understandingStateAt ?? null;
    const ageMinutes = changedAt ? Math.max(0, Math.floor((now - changedAt.getTime()) / 60_000)) : null;
    const hasEvidence = await evidenceExists(prisma, session);
    const { stale, actions } = recoveryEligibility(state, changedAt ?? null, hasEvidence, now);
    if (['APPLIED', 'NO_CHANGE'].includes(session.understandingOutcome || '')) {
      // Already-finalized understanding is never requeued from the monitor.
      const retryIndex = actions.indexOf('RETRY');
      if (retryIndex !== -1) actions.splice(retryIndex, 1);
    }
    items.push({ sessionId: session.id, conversationId: session.conversationId, createdAt: session.createdAt,
      kind: session.pilotEntryId ? 'PILOT' : 'PHONE', state, changedAt, ageMinutes,
      hasEvidence, stale, actions, contextSpaceId: session.contextSpaceId });
  }
  const events = await prisma.dorianCallRecoveryEvent.findMany({
    where: { agentBindingId: { in: bindings } }, orderBy: { createdAt: 'desc' }, take: 30,
    select: { id: true, sessionId: true, operation: true, reasonCode: true, previousState: true,
      nextState: true, createdAt: true }
  });
  return { items, events };
}

// Every write uses the same exact session/deployment tuple as the authorised monitor.
// Atomic compare-and-set prevents a stale monitor page from overriding newer calls or
// worker claims; each successful transition is audited in the same transaction.
export async function recoverDorianCall(viewer: Viewer, input: {
  sessionId: string; operation: string; reasonCode: string;
  confirmedEnded: boolean; confirmedWorkerStopped: boolean;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.sessionId)) throw error(400, 'Invalid call identifier.');
  if (!['RETRY', 'RELEASE', 'MARK_FAILED'].includes(input.operation)) throw error(400, 'Invalid recovery operation.');
  if (!REASONS.has(input.reasonCode)) throw error(400, 'Choose a recovery reason.');
  const bindings = (await ownedBindings(viewer)).map(row => row.id);
  if (!bindings.length) throw error(403, 'No authorised Dorian deployment.');
  const now = new Date();
  await prisma.$transaction(async tx => {
    const session = await tx.networkDorianSession.findFirst({ where: {
      id: input.sessionId, agentBindingId: { in: bindings }, conversationId: { not: null }
    }, select: { id: true, agentBindingId: true, userId: true, contextSpaceId: true,
      contactId: true, conversationId: true, pilotEntryId: true, understandingOutcome: true,
      understandingOutcomeAt: true } });
    if (!session?.conversationId) throw error(404, 'Call not found on an authorised deployment.');
    const pilot = Boolean(session.pilotEntryId);
    const caller = pilot ? null : await tx.networkPhoneCaller.findFirst({ where: {
      userId: session.userId, understandingConversationId: session.conversationId
    }, select: { id: true, understandingState: true, understandingStateAt: true } });
    if (!pilot && !caller) conflict();
    const state = pilot ? session.understandingOutcome : caller!.understandingState;
    const changedAt = pilot ? session.understandingOutcomeAt : caller!.understandingStateAt;
    const evidence = await evidenceExists(tx, session);
    const operation = input.operation as RecoveryOperation;
    if (!recoveryEligibility(state, changedAt ?? null, evidence, now.getTime()).actions.includes(operation) ||
        (operation === 'RETRY' && ['APPLIED', 'NO_CHANGE'].includes(session.understandingOutcome || ''))) {
      throw error(409, 'This call is not eligible for the requested recovery action.');
    }
    let nextState = state;
    let nextOutcome = session.understandingOutcome;
    if (operation === 'MARK_FAILED') {
      if (state !== 'WORKING' || !input.confirmedWorkerStopped || input.reasonCode !== 'WORKER_STOPPED')
        throw error(400, 'Confirm all workers processing this call have stopped before marking it failed.');
      nextState = 'FAILED';
      nextOutcome = ['APPLIED', 'NO_CHANGE'].includes(session.understandingOutcome || '') ? session.understandingOutcome : 'FAILED';
    } else if (operation === 'RETRY') {
      if (!evidence) throw error(409, 'No verified participant transcript exists to retry.');
      if (!(state === 'FAILED' || (state === 'IN_CALL' && input.confirmedEnded)))
        throw error(409, 'Retry is only available for failed processing or an ended, stale call with evidence.');
      if (state === 'IN_CALL' && input.reasonCode !== 'PROVIDER_CALL_ENDED')
        throw error(400, 'Confirm provider call completion for an IN_CALL recovery.');
      nextState = pilot ? 'QUEUED' : 'PROCESSING';
      nextOutcome = pilot ? 'QUEUED' : null;
    } else {
      if (!input.confirmedEnded) throw error(400, 'Confirm that the provider call has ended.');
      if (!['FAILED', 'IN_CALL', 'PROCESSING', 'QUEUED'].includes(state || ''))
        throw error(409, 'A WORKING job must be stopped and marked failed before release.');
      if (state === 'IN_CALL' && input.reasonCode !== 'PROVIDER_CALL_ENDED')
        throw error(400, 'Choose provider call ended as the reason for an IN_CALL release.');
      // No LU result is fabricated. Released work remains visibly unprocessed.
      nextState = pilot ? 'RELEASED_UNPROCESSED' : 'READY';
      nextOutcome = ['APPLIED', 'NO_CHANGE'].includes(session.understandingOutcome || '')
        ? session.understandingOutcome : 'RELEASED_UNPROCESSED';
    }
    if (pilot) {
      const written = await tx.networkDorianSession.updateMany({ where: {
        id: session.id, agentBindingId: session.agentBindingId,
        understandingOutcome: session.understandingOutcome,
        understandingOutcomeAt: session.understandingOutcomeAt
      }, data: { understandingOutcome: nextOutcome, understandingOutcomeAt: now } });
      if (written.count !== 1) conflict();
    } else {
      const written = await tx.networkPhoneCaller.updateMany({ where: {
        id: caller!.id, userId: session.userId, understandingConversationId: session.conversationId,
        understandingState: state!, understandingStateAt: changedAt
      }, data: { understandingState: nextState!, understandingConversationId: operation === 'RELEASE' ? null : session.conversationId,
        understandingStateAt: now } });
      if (written.count !== 1) conflict();
      const stored = await tx.networkDorianSession.updateMany({ where: {
        id: session.id, understandingOutcome: session.understandingOutcome,
        understandingOutcomeAt: session.understandingOutcomeAt
      }, data: { understandingOutcome: nextOutcome, understandingOutcomeAt: now } });
      if (stored.count !== 1) conflict();
    }
    await tx.dorianCallRecoveryEvent.create({ data: {
      actorUserId: viewer.userId, agentBindingId: session.agentBindingId,
      sessionId: session.id, conversationId: session.conversationId,
      participantUserId: session.userId, contextSpaceId: session.contextSpaceId,
      operation, reasonCode: input.reasonCode,
      previousState: state, nextState, previousOutcome: session.understandingOutcome,
      nextOutcome
    } });
  }, { isolationLevel: 'Serializable', timeout: 10_000 });
}
