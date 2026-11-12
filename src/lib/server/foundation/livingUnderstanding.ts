// Foundation repository for prepared candidates and immutable topic snapshots.
// Review reads and writes recheck source admission and the exact baseline.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { decrypt, encrypt } from '$lib/crypto';
import type { AppTransactionClient } from '$lib/db';
import {
	parseCandidate,
	parseSourcePacket,
	type SourcePacket,
	type UnderstandingCandidate
} from '../livingUnderstanding/contracts';
import { FoundationDenied } from './internal';
import { withFoundationAccess, type FoundationAccess } from './policy';
import { aad, activeSubjects, FoundationConflict, mac, scope, scopedId } from './evidenceRecords';
import { segmentState } from './evidence';
import { currentConversation } from './conversations';
import { insertRelationship } from './subjects';
import type {
	AssessmentInput,
	AssessmentProvenance,
	PriorTopic
} from '../livingUnderstanding/semanticAssessment';
import { decodeLuTopic, luEligibility, recordLuMeaning, requireLuPerspective } from './luEvidence';

const candidateTable = 'FoundationLuCandidate';
const approvalTable = 'FoundationLuApproval';
type Destination = { subjectId: string; perspectiveId: string };
type TopicDraft = UnderstandingCandidate['streams'][number]['topics'][number];
type Manifest = SourcePacket['baselines'][number];

async function streamHead(tx: AppTransactionClient, destination: Destination) {
	const stream = await tx.foundationLuStream.findFirst({ where: destination });
	const revision = stream
		? await tx.foundationLuRevision.findFirst({
				where: { streamId: stream.id },
				orderBy: { revisionNumber: 'desc' }
			})
		: null;
	return { stream, revision };
}

async function snapshotMembers(tx: AppTransactionClient, revisionId: string) {
	const rows = await tx.foundationLuRevisionTopic.findMany({
		where: { revisionId },
		orderBy: { position: 'asc' },
		take: 257
	});
	if (!rows.length || rows.length > 256) throw new FoundationDenied();
	return rows;
}
async function topicMeanings(tx: AppTransactionClient, topicVersionId: string) {
	const rows = await tx.foundationLuTopicMeaning.findMany({
		where: { topicVersionId },
		orderBy: { position: 'asc' },
		take: 2001
	});
	if (!rows.length || rows.length > 2000) throw new FoundationDenied();
	return rows;
}
async function baselineManifest(
	tx: AppTransactionClient,
	destination: Destination
): Promise<Manifest> {
	const { revision } = await streamHead(tx, destination);
	const topics: Manifest['topics'] = [];
	if (revision)
		for (const row of await snapshotMembers(tx, revision.id)) {
			topics.push({
				topicId: row.topicId,
				versionId: row.topicVersionId,
				meaningVersionIds: (await topicMeanings(tx, row.topicVersionId)).map(
					(m) => m.statementVersionId
				)
			});
		}
	return { ...destination, revisionId: revision?.id ?? null, topics };
}

async function loadPacket(
	tx: AppTransactionClient,
	access: FoundationAccess,
	personId: string,
	sourceId: string,
	provision: boolean
): Promise<SourcePacket> {
	const { version, capture } = await currentConversation(tx, access, personId, sourceId);
	if (version.processingAdmission !== 'PRIVATE_ANALYSIS' || capture.completeness !== 'COMPLETE')
		throw new FoundationDenied();
	const self = await tx.foundationSubject.findFirst({
		where: { selfUserId: access.ownerUserId, kind: 'PERSON', state: 'ACTIVE' },
		select: { id: true }
	});
	if (!self) throw new FoundationDenied();
	const priorPerspective = await tx.foundationPerspective.findFirst({
		where: { kind: 'OWNER_RECORDED', holderSubjectId: null },
		orderBy: { id: 'asc' },
		select: { id: true }
	});
	const perspective =
		priorPerspective ??
		(provision
			? await tx.foundationPerspective.create({
					data: { ...scope(access), kind: 'OWNER_RECORDED' },
					select: { id: true }
				})
			: null);
	if (!perspective) throw new FoundationDenied();

	// Share the private pair reference already used by note review.
	const relationshipId = scopedId(access, 'note-review-relationship', personId);
	const relationship = await tx.foundationSubject.findFirst({ where: { id: relationshipId } });
	if (relationship && (relationship.kind !== 'RELATIONSHIP' || relationship.state !== 'ACTIVE'))
		throw new FoundationDenied();
	if (!relationship && provision)
		await insertRelationship(
			tx,
			scope(access),
			'Our relationship',
			[self.id, personId],
			'RELATIONSHIP',
			relationshipId
		);
	else if (!relationship) throw new FoundationDenied();

	const subjects = [
		{ id: self.id, kind: 'PERSON' },
		{ id: personId, kind: 'PERSON' },
		{ id: relationshipId, kind: 'RELATIONSHIP' }
	];
	const destinations = subjects.map((s) => ({
		subjectId: s.id,
		perspectiveId: perspective.id,
		perspectiveKind: 'OWNER_RECORDED'
	}));
	const baselines = [];
	for (const s of destinations)
		baselines.push(
			await baselineManifest(tx, { subjectId: s.subjectId, perspectiveId: s.perspectiveId })
		);
	let offset = 0;
	const turns = capture.turns.map((turn) => {
		const start = offset;
		const end = start + turn.text.length;
		offset = end + 1;
		return { id: turn.id, speakerId: turn.role, start, end };
	});
	return parseSourcePacket({
		contract: 'LUR-1',
		scope: { ...scope(access), epoch: access.epoch, selfSubjectId: self.id },
		source: {
			id: sourceId,
			versionId: version.id,
			version: version.version,
			contentMac: version.contentMac,
			kind: 'IMPORTED_CONVERSATION',
			occurredAt: version.occurredAt?.toISOString() ?? null,
			completeness: capture.completeness,
			admission: version.processingAdmission
		},
		text: capture.turns.map((turn) => turn.text).join('\n'),
		subjects,
		destinations,
		speakers: [
			{ id: 'OWNER', role: 'OWNER', subjectId: self.id },
			{ id: 'AGENT', role: 'AGENT', subjectId: null },
			{ id: 'UNRESOLVED', role: 'UNRESOLVED', subjectId: null }
		],
		turns,
		baselines,
		unresolvedMentions: []
	});
}

export function prepareLuInput(access: FoundationAccess, personId: string, sourceId: string) {
	return withFoundationAccess(access, 'PREPARE_LU', (tx) =>
		loadPacket(tx, access, personId, sourceId, true)
	);
}
// Load only eligible prior prose. The manifest retains hidden version IDs so a
// changed snapshot can carry them forward without giving the model their content.
async function loadAssessmentPrior(
	tx: AppTransactionClient,
	access: FoundationAccess,
	packet: SourcePacket
) {
	const prior: PriorTopic[] = [];
	const eligible = luEligibility(tx);
	for (const baseline of packet.baselines) {
		for (const topic of baseline.topics) {
			try {
				for (const versionId of topic.meaningVersionIds)
					await eligible(versionId, baseline.subjectId, baseline.perspectiveId);
			} catch (e) {
				if (e instanceof FoundationDenied) continue;
				throw e;
			}
			const version = await tx.foundationLuTopicVersion.findFirst({
				where: { id: topic.versionId, topicId: topic.topicId }
			});
			if (!version) throw new FoundationDenied();
			const revision = await tx.foundationLuRevision.findFirst({
				where: { id: version.creatingRevisionId },
				select: { sourceVersionId: true }
			});
			const source = revision
				? await tx.foundationSourceVersion.findFirst({
						where: { id: revision.sourceVersionId },
						select: { occurredAt: true }
					})
				: null;
			const values = await tx.foundationStatementVersion.findMany({
				where: { id: { in: topic.meaningVersionIds } },
				select: { id: true, textEnc: true, observedAt: true }
			});
			const byId = new Map(values.map((v) => [v.id, v]));
			const origins = await tx.foundationLuMeaningOrigin.findMany({
				where: { statementVersionId: { in: topic.meaningVersionIds } },
				select: {
					id: true,
					statementVersionId: true,
					contentKind: true,
					epistemicBasis: true,
					generationEnc: true
				}
			});
			const originByVersion = new Map(origins.map((origin) => [origin.statementVersionId, origin]));
			const dates = [source?.occurredAt, ...values.map((v) => v.observedAt)].flatMap((d) =>
				d ? [d.toISOString()] : []
			);
			prior.push({
				subjectId: baseline.subjectId,
				perspectiveId: baseline.perspectiveId,
				topicId: topic.topicId,
				versionId: topic.versionId,
				timeScope: version.timeScope,
				...decodeLuTopic(access, version),
				sourceAt: dates.sort().at(-1) ?? null,
				meanings: topic.meaningVersionIds.map((id) => {
					const meaning = byId.get(id);
					if (!meaning) throw new FoundationDenied();
					const origin = originByVersion.get(id);
					const generation = origin
						? JSON.parse(
								decrypt(
									origin.generationEnc,
									aad(access, 'FoundationLuMeaningOrigin', 'generationEnc', origin.id)
								)
							)
						: null;
					return {
						versionId: id,
						observedAt: meaning.observedAt?.toISOString() ?? null,
						...(origin
							? {
									kind: origin.contentKind,
									basis: origin.epistemicBasis,
									uncertainty:
										typeof generation?.expressedUncertainty === 'string'
											? generation.expressedUncertainty
											: null
								}
							: {}),
						text: decrypt(meaning.textEnc, aad(access, 'FoundationStatementVersion', 'textEnc', id))
					};
				})
			});
		}
	}
	return prior;
}

export function prepareLuAssessment(access: FoundationAccess, personId: string, sourceId: string) {
	return withFoundationAccess(access, 'PREPARE_LU', async (tx) => {
		const packet = await loadPacket(tx, access, personId, sourceId, true);
		return { packet, prior: await loadAssessmentPrior(tx, access, packet) };
	});
}

function comparePacket(current: SourcePacket, expected: SourcePacket) {
	if (JSON.stringify({ ...expected, unresolvedMentions: [] }) !== JSON.stringify(current))
		throw new FoundationConflict();
}
async function checkAssessmentPrior(
	tx: AppTransactionClient,
	access: FoundationAccess,
	packet: SourcePacket,
	prior: PriorTopic[]
) {
	const current = await loadAssessmentPrior(tx, access, packet);
	if (JSON.stringify(current) !== JSON.stringify(prior)) throw new FoundationConflict();
}
export function verifyLuAssessment(
	access: FoundationAccess,
	personId: string,
	input: AssessmentInput
) {
	return withFoundationAccess(access, 'PREPARE_LU', async (tx) => {
		const current = await loadPacket(tx, access, personId, input.packet.source.id, false);
		comparePacket(current, input.packet);
		await checkAssessmentPrior(tx, access, current, input.prior);
	});
}

const assessmentKey = z.string().trim().min(1).max(200);
function assessmentId(access: FoundationAccess, sourceId: string, key: string) {
	return scopedId(
		access,
		'lu-assessment-request',
		JSON.stringify([sourceId, assessmentKey.parse(key)])
	);
}
function inventoryMac(access: FoundationAccess, prior: PriorTopic[]) {
	return mac(access, 'lu-assessment-prior', JSON.stringify(prior));
}

async function readAssessmentReceipt(
	tx: AppTransactionClient,
	access: FoundationAccess,
	candidateId: string,
	personId: string,
	packet: SourcePacket,
	prior: PriorTopic[]
) {
	const row = await tx.foundationLuCandidate.findFirst({ where: { id: candidateId } });
	if (!row) return null;
	if (
		row.epoch !== access.epoch ||
		row.expiresAt <= new Date() ||
		row.sourceVersionId !== packet.source.versionId ||
		row.sourceContentMac !== packet.source.contentMac ||
		(await tx.foundationLuApproval.findFirst({ where: { candidateId }, select: { id: true } }))
	)
		throw new FoundationConflict();
	const stored = JSON.parse(
		decrypt(row.proposalEnc, aad(access, candidateTable, 'proposalEnc', candidateId))
	);
	if (
		stored.personId !== personId ||
		JSON.stringify(stored.baselines) !== JSON.stringify(packet.baselines) ||
		stored.inventoryMac !== inventoryMac(access, prior)
	)
		throw new FoundationConflict();
	return {
		candidateId,
		outcome: row.outcome,
		candidate: parseCandidate(stored.proposal, packet),
		provenance: stored.assessment as AssessmentProvenance,
		unresolvedMentions: parseSourcePacket({
			...packet,
			unresolvedMentions: stored.unresolvedMentions
		}).unresolvedMentions
	};
}
export function resumeLuAssessment(
	access: FoundationAccess,
	personId: string,
	input: AssessmentInput,
	key: string
) {
	return withFoundationAccess(access, 'STORE_LU_CANDIDATE', async (tx) => {
		const packet = await loadPacket(tx, access, personId, input.packet.source.id, false);
		comparePacket(packet, input.packet);
		await checkAssessmentPrior(tx, access, packet, input.prior);
		return readAssessmentReceipt(
			tx,
			access,
			assessmentId(access, packet.source.id, key),
			personId,
			packet,
			input.prior
		);
	});
}

function changedTopics(candidate: UnderstandingCandidate) {
	return candidate.streams.flatMap((stream) =>
		stream.topics
			.filter((topic) => topic.effect !== 'UNCHANGED')
			.map((topic) => ({
				subjectId: stream.subjectId,
				perspectiveId: stream.perspectiveId,
				topicKey: topic.key
			}))
	);
}
export function stableTopicKey(topic: Destination & { topicKey: string }) {
	return JSON.stringify([topic.subjectId, topic.perspectiveId, topic.topicKey]);
}

// Resume only an unreviewed assessment bound to this person's current transcript.
export function readLuCandidateForReview(
	access: FoundationAccess, personId: string, sourceId: string, candidateId: string
) {
	return withFoundationAccess(access, 'STORE_LU_CANDIDATE', async (tx) => {
		const packet = await loadPacket(tx, access, personId, sourceId, false);
		const prior = await loadAssessmentPrior(tx, access, packet);
		const receipt = await readAssessmentReceipt(tx, access, candidateId, personId, packet, prior);
		if (!receipt?.provenance) throw new FoundationDenied();
		return { ...receipt, input: { packet, prior } };
	});
}

// The caller is the server-side assessor. A supplied packet never substitutes for
// current custody, source admission, or baseline checks in this transaction.
export function storeLuCandidate(
	access: FoundationAccess,
	personId: string,
	packet: SourcePacket,
	proposal: unknown,
	assessment?: { requestKey: string; prior: PriorTopic[]; provenance: AssessmentProvenance }
) {
	return withFoundationAccess(access, 'STORE_LU_CANDIDATE', async (tx) => {
		const current = await loadPacket(tx, access, personId, packet.source.id, false);
		const input = parseSourcePacket(packet);
		comparePacket(current, input);
		if (assessment) await checkAssessmentPrior(tx, access, current, assessment.prior);
		const validated = parseCandidate(proposal, current);
		if (validated.meanings.some((m) => m.evidence.length > 128)) throw new FoundationDenied();
		const id = assessment
			? assessmentId(access, current.source.id, assessment.requestKey)
			: randomUUID();
		if (assessment) {
			const existing = await readAssessmentReceipt(
				tx,
				access,
				id,
				personId,
				current,
				assessment.prior
			);
			if (existing) return { candidateId: existing.candidateId, outcome: existing.outcome };
		}
		const outcome = changedTopics(validated).length ? 'READY' : 'NO_CHANGE';
		await tx.foundationLuCandidate.create({
			data: {
				...scope(access),
				id,
				sourceId: current.source.id,
				sourceVersionId: current.source.versionId,
				sourceVersionNumber: current.source.version,
				sourceContentMac: current.source.contentMac,
				epoch: access.epoch,
				expiresAt: new Date(Date.now() + 60 * 60 * 1000),
				outcome,
				proposalEnc: encrypt(
					JSON.stringify({
						personId,
						baselines: current.baselines,
						proposal: validated,
						unresolvedMentions: input.unresolvedMentions,
						...(assessment
							? {
									assessment: assessment.provenance,
									inventoryMac: inventoryMac(access, assessment.prior)
								}
							: {})
					}),
					aad(access, candidateTable, 'proposalEnc', id)
				)
			}
		});
		return { candidateId: id, outcome };
	});
}

const selectionSchema = z.strictObject({
	requestKey: z.string().min(1).max(200),
	decision: z.enum(['APPROVE', 'DEFER', 'REJECT']),
	selected: z
		.array(
			z.strictObject({
				subjectId: z.string().min(1).max(200),
				perspectiveId: z.string().min(1).max(200),
				topicKey: z.string().min(1).max(200)
			})
		)
		.max(768)
});
type ReviewSelection = z.input<typeof selectionSchema>;

async function writeTopic(
	tx: AppTransactionClient,
	access: FoundationAccess,
	revision: { id: string; streamId: string },
	topic: TopicDraft,
	meanings: Map<string, string>,
	ownerEdited: boolean
) {
	const custody = scope(access);
	const previous = topic.previousVersionId
		? await tx.foundationLuTopicVersion.findFirst({
				where: {
					id: topic.previousVersionId,
					topicId: topic.topicId ?? '',
					streamId: revision.streamId
				}
			})
		: null;
	if (topic.effect === 'UNCHANGED' || (topic.effect !== 'NEW' && !previous))
		throw new FoundationConflict();
	const topicId =
		previous?.topicId ??
		(await tx.foundationLuTopic.create({ data: { ...custody, streamId: revision.streamId } })).id;
	const id = randomUUID();
	await tx.foundationLuTopicVersion.create({
		data: {
			...custody,
			id,
			streamId: revision.streamId,
			topicId,
			creatingRevisionId: revision.id,
			version: (previous?.version ?? 0) + 1,
			previousVersionId: previous?.id ?? null,
			previousVersionNumber: previous?.version ?? null,
			effect: topic.effect,
			timeScope: topic.timeScope,
			contentEnc: encrypt(
				JSON.stringify({ area: topic.area, title: topic.title, prose: topic.prose, ...(ownerEdited ? { ownerEdited } : {}) }),
				aad(access, 'FoundationLuTopicVersion', 'contentEnc', id)
			)
		}
	});
	// Carry existing membership roles forward. New contextual memberships must be
	// explicit in the validated candidate.
	const previousMembership = previous ? await topicMeanings(tx, previous.id) : [];
	const membership = [
		...previousMembership.filter((row) =>
			topic.retainedMeaningVersionIds.includes(row.statementVersionId)
		),
		...topic.meaningIds.map((key) => {
			const statementVersionId = meanings.get(key);
			if (!statementVersionId) throw new FoundationDenied();
			return {
				statementVersionId,
				role: topic.contextualMeaningIds?.includes(key)
					? ('CONTEXTUAL' as const)
					: ('PRIMARY' as const)
			};
		})
	];
	for (const [position, { statementVersionId, role }] of membership.entries()) {
		await tx.foundationLuTopicMeaning.create({
			data: { ...custody, topicVersionId: id, statementVersionId, position, role }
		});
	}
	return { topicId, topicVersionId: id };
}

export function approveLuCandidate(
	access: FoundationAccess,
	candidateId: string,
	rawSelection: ReviewSelection,
	binding?: { personId: string; sourceId: string }
) {
	const input = selectionSchema.parse(rawSelection);
	const selectedKeys = input.selected.map(stableTopicKey).sort();
	if (
		new Set(selectedKeys).size !== selectedKeys.length ||
		(input.decision === 'APPROVE') !== Boolean(selectedKeys.length)
	)
		throw new FoundationDenied();
	return withFoundationAccess(access, 'APPROVE_LU', async (tx) => {
		const requestKeyMac = mac(access, 'lu-review-key', input.requestKey);
		const requestMac = mac(
			access,
			'lu-review-request',
			JSON.stringify([candidateId, input.decision, selectedKeys, ...(binding ? [binding] : [])])
		);
		const replay = await tx.foundationLuApproval.findFirst({ where: { requestKeyMac } });
		// Return only an opaque receipt after rechecking the current vault authority.
		if (replay) {
			if (replay.requestMac !== requestMac) throw new FoundationConflict();
			return { approvalId: replay.id };
		}
		const row = await tx.foundationLuCandidate.findFirst({ where: { id: candidateId } });
		if (
			!row ||
			row.epoch !== access.epoch ||
			row.expiresAt <= new Date() ||
			row.outcome !== 'READY'
		)
			throw new FoundationDenied();
		if (await tx.foundationLuApproval.findFirst({ where: { candidateId }, select: { id: true } }))
			throw new FoundationConflict();
		const stored = JSON.parse(
			decrypt(row.proposalEnc, aad(access, candidateTable, 'proposalEnc', row.id))
		);
		if (binding && (binding.personId !== stored.personId || binding.sourceId !== row.sourceId))
			throw new FoundationDenied();
		const packet = await loadPacket(tx, access, stored.personId, row.sourceId, false);
		if (
			packet.source.versionId !== row.sourceVersionId ||
			packet.source.contentMac !== row.sourceContentMac ||
			JSON.stringify(packet.baselines) !== JSON.stringify(stored.baselines)
		)
			throw new FoundationConflict();
		// A prior topic can become ineligible without a new stream revision.
		if (
			stored.inventoryMac &&
			stored.inventoryMac !== inventoryMac(access, await loadAssessmentPrior(tx, access, packet))
		)
			throw new FoundationConflict();
		const candidate = parseCandidate(stored.proposal, packet);
		const possible = changedTopics(candidate);
		const keys = new Set(selectedKeys);
		if (selectedKeys.some((key) => !possible.some((topic) => stableTopicKey(topic) === key)))
			throw new FoundationDenied();
		const isSelected = (s: Destination, t: TopicDraft) =>
			keys.has(
				stableTopicKey({
					subjectId: s.subjectId,
					perspectiveId: s.perspectiveId,
					topicKey: t.key
				})
			);
		const approvalId = randomUUID();
		const custody = scope(access);
		await tx.foundationLuApproval.create({
			data: {
				...custody,
				id: approvalId,
				candidateId,
				requestKeyMac,
				requestMac,
				selectionEnc: encrypt(
					JSON.stringify({
						actor: access.actorId,
						method: 'EXPLICIT_OWNER_REVIEW',
						decision: input.decision,
						topics: possible.map((topic) => ({
							...topic,
							disposition: keys.has(stableTopicKey(topic))
								? 'APPROVED'
								: input.decision === 'REJECT'
									? 'REJECTED'
									: 'DEFERRED'
						}))
					}),
					aad(access, approvalTable, 'selectionEnc', approvalId)
				)
			}
		});

		const eligible = luEligibility(tx);
		const meaningIds = new Map<string, string>();
		for (const s of candidate.streams) {
			const selected = s.topics.filter((topic) => isSelected(s, topic));
			if (!selected.length) continue;
			const destination = { subjectId: s.subjectId, perspectiveId: s.perspectiveId };
			const { stream, revision: previous } = await streamHead(tx, destination);
			const streamId =
				stream?.id ??
				(await tx.foundationLuStream.create({ data: { ...custody, ...destination } })).id;
			const revision = await tx.foundationLuRevision.create({
				data: {
					...custody,
					streamId,
					revisionNumber: (previous?.revisionNumber ?? 0) + 1,
					previousRevisionId: previous?.id ?? null,
					previousRevisionNumber: previous?.revisionNumber ?? null,
					approvalId,
					sourceVersionId: packet.source.versionId
				}
			});
			const old = new Map(
				(previous ? await snapshotMembers(tx, previous.id) : []).map((member) => [
					member.topicId,
					member
				])
			);
			let position = 0;
			for (const topic of s.topics) {
				let member: { topicId: string; topicVersionId: string } | undefined;
				if (isSelected(s, topic)) {
					// Partial approval retains every unselected prior version. For a changed
					// topic, all explicitly retained meanings must still be eligible.
					for (const versionId of topic.retainedMeaningVersionIds)
						await eligible(versionId, s.subjectId, s.perspectiveId);
					for (const key of topic.meaningIds) {
						if (!meaningIds.has(key)) {
							const meaning = candidate.meanings.find((item) => item.id === key);
							if (!meaning) throw new FoundationDenied();
							meaningIds.set(key, await recordLuMeaning(tx, access, packet, meaning));
						}
					}
					const editKey = stableTopicKey({ ...destination, topicKey: topic.key });
					const ownerEdited = (stored.assessment as AssessmentProvenance | undefined)
						?.ownerEdits?.some((edit) => edit.topic === editKey) ?? false;
					member = await writeTopic(tx, access, revision, topic, meaningIds, ownerEdited);
				} else if (topic.topicId) member = old.get(topic.topicId);
				if (member)
					await tx.foundationLuRevisionTopic.create({
						data: {
							...custody,
							revisionId: revision.id,
							streamId,
							topicId: member.topicId,
							topicVersionId: member.topicVersionId,
							position: position++
						}
					});
			}
		}
		return { approvalId };
	});
}

async function readRevision(
	tx: AppTransactionClient, access: FoundationAccess, destination: Destination, revisionNumber?: number, includeTopicHistory = false
) {
	await activeSubjects(tx, [destination.subjectId]);
	await requireLuPerspective(tx, destination.perspectiveId);
	const stream = await tx.foundationLuStream.findFirst({
		where: { subjectId: destination.subjectId, perspectiveId: destination.perspectiveId }
	});
	if (!stream) return null;
	const revision = await tx.foundationLuRevision.findFirst({
		where: { streamId: stream.id, ...(revisionNumber === undefined ? {} : { revisionNumber }) },
		orderBy: { revisionNumber: 'desc' }
	});
	if (!revision) return null;
	const eligible = luEligibility(tx);
	const topics = [];
	for (const member of await snapshotMembers(tx, revision.id)) {
		const version = await tx.foundationLuTopicVersion.findFirst({
			where: { id: member.topicVersionId, streamId: stream.id }
		});
		if (!version) throw new FoundationDenied();
		const meanings = await topicMeanings(tx, version.id);
		try {
			for (const meaning of meanings)
				await eligible(
					meaning.statementVersionId,
					destination.subjectId,
					destination.perspectiveId
				);
		} catch (e) {
			// A withdrawn dependency suppresses this topic, including title and evidence.
			if (e instanceof FoundationDenied) continue;
			throw e;
		}
		const created = includeTopicHistory && version.previousVersionId
			? await tx.foundationLuRevision.findFirst({
				where: { id: version.creatingRevisionId, streamId: stream.id }, select: { previousRevisionNumber: true }
			}) : null;
		topics.push({
			...(created?.previousRevisionNumber ? { previousTopicRevision: created.previousRevisionNumber } : {}),
			topicId: version.topicId,
			versionId: version.id,
			version: version.version,
			timeScope: version.timeScope,
			effect: version.effect,
			...decodeLuTopic(access, version),
			meaningVersionIds: meanings.map((m) => m.statementVersionId)
		});
	}
	return topics.length ? {
		revisionNumber: revision.revisionNumber, topics,
		...(includeTopicHistory ? { savedAt: revision.createdAt.toISOString() } : {})
	} : null;
}

export function readLuRevision(
	access: FoundationAccess, destination: Destination, revisionNumber?: number
) {
	return withFoundationAccess(access, 'READ_LU', (tx) =>
		readRevision(tx, access, destination, revisionNumber));
}

export const reviewGroups = ['self', 'person', 'relationship'] as const;
export type ReviewGroup = typeof reviewGroups[number];

export function readPersonLuHistory(
	access: FoundationAccess, personId: string,
	selection: { group?: ReviewGroup; revision?: number; topic?: string; evidence?: string }
) {
	return withFoundationAccess(access, 'READ_LU', async (tx) => {
		const person = await tx.foundationSubject.findFirst({
			where: { id: personId, kind: 'PERSON', state: 'ACTIVE', selfUserId: null },
			select: { id: true }
		});
		if (!person) throw new FoundationDenied();
		const self = await tx.foundationSubject.findFirst({
			where: { kind: 'PERSON', state: 'ACTIVE', selfUserId: access.ownerUserId },
			select: { id: true }
		});
		const perspective = await tx.foundationPerspective.findFirst({
			where: { kind: 'OWNER_RECORDED', holderSubjectId: null },
			orderBy: { id: 'asc' }, select: { id: true }
		});
		if (!self || !perspective || self.id === personId) return [];
		const relationship = await tx.foundationSubject.findFirst({
			where: { id: scopedId(access, 'note-review-relationship', personId), kind: 'RELATIONSHIP', state: 'ACTIVE' },
			select: { id: true }
		});
		const ids = { self: self.id, person: personId, relationship: relationship?.id };
		const groups = [];
		for (const group of reviewGroups) {
			const subjectId = ids[group];
			if (!subjectId) continue;
			const destination = { subjectId, perspectiveId: perspective.id };
			const selected = selection.group === group;
			const snapshot = await readRevision(tx, access, destination, selected ? selection.revision : undefined, true);
			if (!snapshot) continue;
			const topics = [];
			for (const { meaningVersionIds, ...topic } of snapshot.topics) {
				if (selected && selection.topic && selection.topic !== topic.topicId) continue;
				const evidence = selected && selection.evidence === topic.versionId
					? await readTopicEvidence(tx, access, meaningVersionIds) : null;
				topics.push({ ...topic, evidence });
			}
			groups.push({ group, revision: snapshot.revisionNumber, savedAt: snapshot.savedAt, topics });
		}
		return groups;
	});
}

async function readTopicEvidence(
	tx: AppTransactionClient, access: FoundationAccess, meaningVersionIds: string[]
) {
	// The snapshot reader checked every dependency before this projection.
	const evidence = [];
	for (const outputVersionId of meaningVersionIds) {
		const origin = await tx.foundationLuMeaningOrigin.findFirst({
			where: { statementVersionId: outputVersionId },
			select: { contentKind: true, epistemicBasis: true, asserterKind: true, generatorKind: true }
		});
		const edges = await tx.foundationSupport.findMany({ where: { outputVersionId }, orderBy: { id: 'asc' }, take: 128 });
		for (const edge of edges) {
			if (!edge.segmentId) continue;
			const { segment } = await segmentState(tx, edge.segmentId, true);
			const anchor = JSON.parse(decrypt(segment.anchorEnc,
				aad(access, 'FoundationEvidenceSegment', 'anchorEnc', segment.id)));
			const source = await tx.foundationSourceVersion.findFirst({
				where: { id: segment.sourceVersionId }, select: { sourceId: true, version: true }
			});
			const binding = source && await tx.foundationSourcePresentationVersion.findFirst({
				where: { sourceId: source.sourceId, version: 1 }, select: { subjectId: true }
			});
			evidence.push({
				quote: decrypt(segment.excerptEnc, aad(access, 'FoundationEvidenceSegment', 'excerptEnc', segment.id)),
				role: edge.relation,
				speaker: anchor.speakerRole as string | undefined,
				origin,
				link: source && binding
					? '/people/' + binding.subjectId + '?conversation=' + source.sourceId + '&transcript=1#' +
						(typeof anchor.turnId === 'string' ? 'turn-' + encodeURIComponent(anchor.turnId) : 'conversation-transcript')
					: null
			});
			if (evidence.length === 128) return evidence;
		}
	}
	return evidence;
}
