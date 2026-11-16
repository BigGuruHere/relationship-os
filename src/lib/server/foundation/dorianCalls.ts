import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/db';
import { fetchElevenLabsConversation } from '$lib/server/integrations/elevenlabs/conversation';
import { capturedPeopleConversation } from '$lib/server/integrations/elevenlabs/peopleWebNote';
import { AssessmentError, type AssessmentStagePanel } from '$lib/server/livingUnderstanding/semanticAssessment';
import { saveDorianSelfConversation } from './conversations';
import { dorianConsentVersion, foundationDorianAgent } from './dorianCallConfig';
import { FoundationConflict } from './evidenceRecords';
import { FoundationDenied } from './internal';
import { runFoundationConversationAssessment } from './luAssessment';
import { resolveDorianCallAccess, withFoundationAccess, type FoundationAccess } from './policy';

export function registerDorianCall(access: FoundationAccess, agentId: string, conversationId: string) {
	return withFoundationAccess(access, 'READ', async (tx) => {
		if (agentId !== foundationDorianAgent() || !/^conv_[a-z0-9_-]{1,235}$/i.test(conversationId))
			throw new FoundationDenied();
		const self = await tx.foundationSubject.findFirst({
			where: { selfUserId: access.ownerUserId, kind: 'PERSON', state: 'ACTIVE' }, select: { id: true }
		});
		if (!self) throw new FoundationDenied();
		await tx.dorianFoundationCall.create({
			data: {
				ownerUserId: access.ownerUserId, vaultId: access.vaultId, epoch: access.epoch,
				subjectId: self.id, conversationId, agentId, consentVersion: dorianConsentVersion,
				runKey: randomUUID(), nextAttemptAt: new Date(Date.now() + 20_000)
			}
		});
	});
}

const providerWindowMs = 2 * 60 * 60_000;
const retryableAssessment = new Set(['MODEL_TIMEOUT', 'MODEL_UNAVAILABLE', 'MODEL_FAILURE', 'MODEL_ERROR']);

export async function processDorianFoundationCall(fetchConversation = fetchElevenLabsConversation) {
	if (!foundationDorianAgent()) return false;
	const due = { state: 'QUEUED' as const, nextAttemptAt: { lte: new Date() } };
	const call = await prisma.dorianFoundationCall.findFirst({
		where: due, orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }]
	});
	if (!call) return false;
	const lease = randomUUID();
	// The lease comfortably covers the bounded assessment. Expiry recovers a crashed worker.
	const claim = await prisma.dorianFoundationCall.updateMany({
		where: { id: call.id, ...due }, data: { lease, nextAttemptAt: new Date(Date.now() + 6 * 60_000) }
	});
	if (!claim.count) return true;
	const where = { id: call.id, state: 'QUEUED' as const, lease };
	const after = (ms: number) => new Date(Date.now() + ms);
	const grant = { kind: 'worker' as const, lease };
	let sourceId = call.sourceId;
	try {
		if (!sourceId) {
			const access = await resolveDorianCallAccess(call.id, grant, 'SAVE_CONVERSATION');
			const data = await fetchConversation(call.conversationId, undefined, fetch, AbortSignal.timeout(8000));
			const expired = Date.now() - call.createdAt.getTime() >= providerWindowMs;
			if (data.status !== 'done') {
				await prisma.dorianFoundationCall.updateMany({ where, data: {
					lease: null, failures: 0, nextAttemptAt: after(30_000),
					...(expired || data.status === 'failed' ? { state: 'INCOMPLETE' } : {})
				} });
				return true;
			}
			const capture = capturedPeopleConversation(data, call.conversationId, call.agentId);
			if (!capture.turns.length) {
				await prisma.dorianFoundationCall.updateMany({ where, data: { state: 'INCOMPLETE', lease: null } });
				return true;
			}
			({ sourceId } = await saveDorianSelfConversation(access, capture));
			const done = capture.completeness !== 'COMPLETE';
			const attached = await prisma.dorianFoundationCall.updateMany({
				where, data: { sourceId, ...(done ? { state: 'INCOMPLETE', lease: null } : {}) }
			});
			if (done || !attached.count) return true;
		}
		const [prepare, store] = await Promise.all([
			resolveDorianCallAccess(call.id, grant, 'PREPARE_LU'),
			resolveDorianCallAccess(call.id, grant, 'STORE_LU_CANDIDATE')
		]);
		const stageReview: AssessmentStagePanel[] = [];
		const result = await runFoundationConversationAssessment(prepare, store, call.subjectId, sourceId,
			call.runKey, { method: 'SELF_TOPICS', stageReview, failureReference: randomUUID() });
		await prisma.dorianFoundationCall.updateMany({
			where, data: { state: result.outcome === 'READY' ? 'READY' : 'NO_CHANGE', candidateId: result.candidateId, lease: null }
		});
	} catch (cause) {
		// Evidence or audit failures are held for inspection. Retry transient failures
		// and stale baselines with the same transcript and bounded backoff.
		const held = cause instanceof AssessmentError && !retryableAssessment.has(cause.reason);
		const failures = call.failures + 1;
		const stop = held || cause instanceof FoundationDenied || failures >= 6;
		await prisma.dorianFoundationCall.updateMany({ where, data: {
			lease: null, failures, nextAttemptAt: after(30_000 * Math.min(failures, 6)),
			...(stop ? { state: held ? 'HELD' : 'FAILED' } : {}),
			...(cause instanceof FoundationConflict ? { runKey: randomUUID() } : {})
		} });
	}
	return true;
}
