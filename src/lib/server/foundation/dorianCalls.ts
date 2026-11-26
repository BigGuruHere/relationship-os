import { randomUUID } from 'node:crypto';
import { prisma, type AppTransactionClient } from '$lib/db';
import { fetchElevenLabsConversation } from '$lib/server/integrations/elevenlabs/conversation';
import { capturedPeopleConversation } from '$lib/server/integrations/elevenlabs/peopleWebNote';
import { AssessmentError, type AssessmentStagePanel } from '$lib/server/livingUnderstanding/semanticAssessment';
import { readDorianRecentConversation, saveDorianSelfConversation } from './conversations';
import { dorianConsentVersion, dorianProviderWindowMs, foundationDorianAgent } from './dorianCallConfig';
import { FoundationConflict } from './evidenceRecords';
import { FoundationDenied } from './internal';
import { runFoundationConversationAssessment } from './luAssessment';
import { readDorianContinuity } from './livingUnderstanding';
import { foundationCallInitiation, type FoundationCallPurpose } from '../integrations/elevenlabs/foundationCallContext';
import { readFoundationDorianScenarios } from '../integrations/elevenlabs/dorianControlPlane';
import { foundationScenarioCopy } from '../integrations/elevenlabs/foundationScenarioCopy';
import { resolveDorianCallAccess, withFoundationAccess, type FoundationAccess } from './policy';

// Used for both transports. The final check runs under the Foundation account lock.
export function dorianCallProcessing(db: Pick<AppTransactionClient, 'dorianFoundationCall'>, ownerUserId: string, vaultId: string, epoch: number) {
	return db.dorianFoundationCall.findFirst({
		where: { ownerUserId, vaultId, epoch, state: 'QUEUED',
			OR: [{ sourceId: { not: null } }, { createdAt: { gt: new Date(Date.now() - dorianProviderWindowMs) } }] },
		select: { id: true }
	});
}

export class DorianCallProcessing extends Error {}

export function registerDorianCall(access: FoundationAccess, agentId: string, conversationId: string) {
	return withFoundationAccess(access, 'READ', async (tx) => {
		if (agentId !== foundationDorianAgent() || !/^conv_[a-z0-9_-]{1,235}$/i.test(conversationId))
			throw new FoundationDenied();
		if (await dorianCallProcessing(tx, access.ownerUserId, access.vaultId, access.epoch))
			throw new DorianCallProcessing();
		const self = await tx.foundationSubject.findFirst({
			where: { selfUserId: access.ownerUserId, kind: 'PERSON', state: 'ACTIVE' }, select: { id: true }
		});
		if (!self) throw new FoundationDenied();
		return tx.dorianFoundationCall.create({
			data: {
				ownerUserId: access.ownerUserId, vaultId: access.vaultId, epoch: access.epoch,
				subjectId: self.id, conversationId, agentId, consentVersion: dorianConsentVersion,
				runKey: randomUUID(), nextAttemptAt: new Date(Date.now() + 20_000)
			}
		});
	});
}

const unconnectedLaunchWindowMs = 2 * 60_000;
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
			const age = Date.now() - call.createdAt.getTime();
			// A browser token can be abandoned before WebRTC connects. Release
			// that reservation without waiting out the full transcript window.
			const expired = age >= dorianProviderWindowMs ||
				(data.status === 'initiated' && age >= unconnectedLaunchWindowMs);
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

// Recheck the issued call grant inside the transaction before replacing a queue entry.
export function requeueDorianAnalysis(access: FoundationAccess) {
	const call = access.dorian;
	if (!call?.sourceId) throw new FoundationDenied();
	return withFoundationAccess(access, 'STORE_LU_CANDIDATE', async (tx) => {
		const changed = await tx.dorianFoundationCall.updateMany({
			where: { id: call.id, state: { in: ['FAILED', 'HELD', 'READY'] }, candidateId: call.candidateId },
			data: { state: 'QUEUED', candidateId: null, lease: null, failures: 0,
				nextAttemptAt: new Date(), runKey: randomUUID() }
		});
		if (!changed.count) throw new FoundationConflict();
	});
}

// Only a server-registered, consented call can select the account and private context.
export async function prepareDorianCall(id: string, purpose?: FoundationCallPurpose) {
	const access = await resolveDorianCallAccess(id, { kind: 'launch' }, 'READ_LU');
	const topics = await readDorianContinuity(access);
	const recent = await readDorianRecentConversation(
		await resolveDorianCallAccess(id, { kind: 'launch' }, 'READ_CONVERSATION'));
	const profile = await prisma.profile.findFirst({
		where: { userId: access.ownerUserId, isDefault: true },
		select: { displayName: true }, orderBy: { id: 'asc' }
	});
	const telephone = access.dorian?.telephone ?? false;
	const published = access.dorian && await readFoundationDorianScenarios(access.dorian.agentId);
	return foundationCallInitiation({ name: profile?.displayName ?? '', topics, ...recent,
		channel: telephone ? 'TELEPHONE' : 'WEB', purpose,
		...(published ? { copy: foundationScenarioCopy(published.scenarios, telephone, recent.returning),
			revision: published.revision } : {}) });
}
