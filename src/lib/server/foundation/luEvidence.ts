// Exact evidence materialization and bounded eligibility checks for LU snapshots.
import { randomUUID } from 'node:crypto';
import { encrypt, decrypt } from '$lib/crypto';
import type { AppTransactionClient } from '$lib/db';
import type { FoundationAccess } from './policy';
import type { SourcePacket, UnderstandingCandidate } from '../livingUnderstanding/contracts';
import { FoundationDenied } from './internal';
import { segmentState } from './evidence';
import { aad, activeSubjects, recordEvidenceSegment, scope } from './evidenceRecords';

export async function recordLuMeaning(
	tx: AppTransactionClient,
	access: FoundationAccess,
	packet: SourcePacket,
	meaning: UnderstandingCandidate['meanings'][number]
) {
	const custody = scope(access);
	const speaker = packet.speakers.find((s) => s.id === meaning.speakerId);
	if (!speaker) throw new FoundationDenied();
	const statementId = randomUUID();
	const statementVersionId = randomUUID();
	await tx.foundationStatement.create({
		data: { ...custody, id: statementId, perspectiveId: meaning.perspectiveId }
	});
	await tx.foundationStatementVersion.create({
		data: {
			...custody,
			id: statementVersionId,
			statementId,
			version: 1,
			// DECLARED only represents an owner speaking about their own state.
			mode:
				meaning.basis === 'DIRECT_ACCOUNT' &&
				speaker.role === 'OWNER' &&
				meaning.subjectId === packet.scope.selfSubjectId
					? 'DECLARED'
					: 'OBSERVED',
			confidence: meaning.confidence,
			textEnc: encrypt(
				meaning.text,
				aad(access, 'FoundationStatementVersion', 'textEnc', statementVersionId)
			),
			provenanceEnc: encrypt(
				JSON.stringify({ contract: 'LUR-1' }),
				aad(access, 'FoundationStatementVersion', 'provenanceEnc', statementVersionId)
			),
			observedAt: meaning.observedAt ? new Date(meaning.observedAt) : null,
			validFrom: meaning.validFrom ? new Date(meaning.validFrom) : null,
			validUntil: meaning.validUntil ? new Date(meaning.validUntil) : null
		}
	});
	await tx.foundationStatementSubject.create({
		data: { ...custody, statementVersionId, subjectId: meaning.subjectId }
	});

	let primarySegmentId: string | undefined;
	const edges = new Set<string>();
	for (const evidence of meaning.evidence) {
		const turn = packet.turns.find((t) => t.id === evidence.turnId);
		const speaker = packet.speakers.find((s) => s.id === turn?.speakerId);
		if (!turn || !speaker) throw new FoundationDenied();
		// parseCandidate already checked the quote against this exact immutable version.
		const segmentId = await recordEvidenceSegment(
			tx,
			access,
			evidence.sourceVersionId,
			packet.source.contentMac,
			evidence.start,
			evidence.end,
			evidence.quote,
			[],
			speaker.subjectId ?? undefined,
			{ turnId: turn.id, speakerRole: speaker.role }
		);
		const key = segmentId + ':' + evidence.role;
		if (edges.has(key)) continue;
		edges.add(key);
		await tx.foundationSupport.create({
			data: { ...custody, outputVersionId: statementVersionId, segmentId, relation: evidence.role }
		});
		if (evidence.role === 'SUPPORTS') primarySegmentId ??= segmentId;
	}
	if (!primarySegmentId) throw new FoundationDenied();
	const asserterSubjectId =
		meaning.asserter.kind === 'SOURCE_SPEAKER'
			? speaker.subjectId
			: meaning.asserter.kind === 'REPORTED_PERSON'
				? meaning.asserter.referenceId
				: null;
	const originId = randomUUID();
	await tx.foundationLuMeaningOrigin.create({
		data: {
			...custody,
			id: originId,
			statementVersionId,
			primarySegmentId,
			contentKind: meaning.kind,
			epistemicBasis: meaning.basis,
			asserterKind: meaning.asserter.kind,
			asserterSubjectId,
			asserterSubjectKind: asserterSubjectId ? 'PERSON' : null,
			generatorKind: meaning.generation.kind,
			recorderKind: meaning.recorder,
			generationEnc: encrypt(
				JSON.stringify({
					...meaning.generation,
					speakerId: meaning.speakerId,
					expressedUncertainty: meaning.expressedUncertainty
				}),
				aad(access, 'FoundationLuMeaningOrigin', 'generationEnc', originId)
			)
		}
	});
	return statementVersionId;
}

export async function requireLuPerspective(tx: AppTransactionClient, perspectiveId: string) {
	const perspective = await tx.foundationPerspective.findFirst({
		where: { id: perspectiveId, kind: 'OWNER_RECORDED', holderSubjectId: null },
		select: { id: true }
	});
	if (!perspective) throw new FoundationDenied();
}

// One reader per guarded transaction. Validate all dependencies before decrypting topic prose.
export function luEligibility(tx: AppTransactionClient) {
	const checked = new Map<string, { perspectiveId: string; subjectIds: string[] }>();
	const checkedSegments = new Set<string>();
	const stack = new Set<string>();
	async function visit(
		versionId: string
	): Promise<{ perspectiveId: string; subjectIds: string[] }> {
		const cached = checked.get(versionId);
		if (cached) return cached;
		if (stack.has(versionId) || stack.size >= 32 || checked.size >= 2048)
			throw new FoundationDenied();
		stack.add(versionId);
		try {
			const version = await tx.foundationStatementVersion.findFirst({
				where: { id: versionId },
				select: { statementId: true }
			});
			// Time scope is meaning, separate from source eligibility. Historical
			// statements remain readable while their support is still permitted.
			if (!version) throw new FoundationDenied();
			const root = await tx.foundationStatement.findFirst({
				where: { id: version.statementId, state: 'ACTIVE' },
				select: { perspectiveId: true }
			});
			if (!root) throw new FoundationDenied();
			await requireLuPerspective(tx, root.perspectiveId);
			const subjects = await tx.foundationStatementSubject.findMany({
				where: { statementVersionId: versionId },
				select: { subjectId: true },
				take: 33
			});
			if (subjects.length > 32) throw new FoundationDenied();
			const subjectIds = subjects.map((s) => s.subjectId);
			const origin = await tx.foundationLuMeaningOrigin.findFirst({
				where: { statementVersionId: versionId },
				select: { asserterSubjectId: true, primarySegmentId: true }
			});
			if (!subjectIds.length) throw new FoundationDenied();
			await activeSubjects(tx, [
				...new Set([
					...subjectIds,
					...(origin?.asserterSubjectId ? [origin.asserterSubjectId] : [])
				])
			]);
			const edges = await tx.foundationSupport.findMany({
				where: { outputVersionId: versionId },
				take: 129
			});
			if (edges.length > 128 || !edges.some((edge) => edge.relation === 'SUPPORTS'))
				throw new FoundationDenied();
			if (
				origin &&
				!edges.some((e) => e.relation === 'SUPPORTS' && e.segmentId === origin.primarySegmentId)
			)
				throw new FoundationDenied();
			for (const edge of edges) {
				if (!['SUPPORTS', 'QUALIFIES', 'CONTRADICTS', 'CONTEXT'].includes(edge.relation))
					throw new FoundationDenied();
				if (edge.segmentId && !edge.inputVersionId) {
					if (!checkedSegments.has(edge.segmentId)) {
						if (checkedSegments.size >= 4096) throw new FoundationDenied();
						await segmentState(tx, edge.segmentId, true);
						checkedSegments.add(edge.segmentId);
					}
				} else if (edge.inputVersionId && !edge.segmentId) {
					await visit(edge.inputVersionId);
				} else throw new FoundationDenied();
			}
			const eligible = { perspectiveId: root.perspectiveId, subjectIds };
			checked.set(versionId, eligible);
			return eligible;
		} finally {
			stack.delete(versionId);
		}
	}
	return async (versionId: string, subjectId: string, perspectiveId: string) => {
		const eligible = await visit(versionId);
		if (eligible.perspectiveId !== perspectiveId || !eligible.subjectIds.includes(subjectId))
			throw new FoundationDenied();
	};
}

export function decodeLuTopic(
	access: FoundationAccess,
	version: { id: string; contentEnc: string }
) {
	return JSON.parse(
		decrypt(version.contentEnc, aad(access, 'FoundationLuTopicVersion', 'contentEnc', version.id))
	) as {
		area: string;
		title: string;
		prose: string;
	};
}
