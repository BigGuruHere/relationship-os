// Versioned owner evidence. P-303 routes pass explicit owner authority and stored-only admission.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { encrypt, decrypt } from '$lib/crypto';
import type { AppTransactionClient } from '$lib/db';
import { FoundationDenied } from './internal';
import { withFoundationAccess, type FoundationAccess } from './policy';
import { insertRelationship } from './subjects';
import { FoundationConflict, scope, mac, aad, activeSubjects, lineage, scopedId, recordEvidenceSegment } from './evidenceRecords';
export { FoundationConflict } from './evidenceRecords';

const id = z.string().min(1).max(200);
const subjects = z
	.array(id)
	.min(1)
	.max(32)
	.refine((values) => new Set(values).size === values.length)
	.transform((values) => values.sort());
const revision = { key: id, expectedVersion: z.number().int().min(0).max(2147483646) };
const note = z.strictObject({
	...revision,
	text: z.string().min(1).max(64000),
	start: z.number().int().nonnegative(),
	end: z.number().int().positive(),
	quote: z.string().min(1).max(8000),
	subjectIds: subjects,
	speakerId: id.optional(),
	allowPrivateAnalysis: z.boolean().default(false),
	captureKind: z.enum(['OWNER_NOTE', 'VOICE_NOTE']).optional(),
	summary: z.string().max(20000).optional(),
	occurredAt: z.string().datetime().optional()
});
const reviewProposal = z.strictObject({
	bucket: z.enum(['self', 'person', 'relationship']),
	text: z.string().trim().min(1).max(400),
	quote: z.string().min(1).max(500),
	mode: z.enum(['OBSERVED', 'INFERRED'])
});
export const reviewProposals = z.array(reviewProposal).max(6);
export type NoteReviewProposal = z.infer<typeof reviewProposal>;
type ReviewReceipt = { key: string; entries: { bucket: NoteReviewProposal['bucket']; statementId: string; start: number; end: number }[] };

const statement = z.strictObject({
	...revision,
	text: z.string().trim().min(1).max(8000),
	perspectiveId: id,
	subjectIds: subjects,
	segmentId: id,
	mode: z.enum(['DECLARED', 'OBSERVED', 'INFERRED']),
	confidence: z.enum(['LOW', 'MEDIUM', 'HIGH'])
});
// A valid UTF-16 offset must not divide a surrogate pair.
function splitsPair(text: string, offset: number) {
	return (
		/[\uD800-\uDBFF]/.test(text.charAt(offset - 1)) && /[\uDC00-\uDFFF]/.test(text.charAt(offset))
	);
}
function anchorIsValid(input: z.infer<typeof note>) {
	return (
		input.end <= input.text.length &&
		input.start < input.end &&
		!splitsPair(input.text, input.start) &&
		!splitsPair(input.text, input.end) &&
		input.text.slice(input.start, input.end) === input.quote
	);
}
// The F-204 account and vault locks serialize expected-version comparison, replay and all inserts.
export function appendOwnerNote(access: FoundationAccess, values: z.input<typeof note>, correctionSourceId?: string) {
	return withFoundationAccess(access, 'RECORD_EVIDENCE', (tx) => recordOwnerNote(tx, access, values, correctionSourceId));
}

async function recordOwnerNote(tx: AppTransactionClient, access: FoundationAccess,
	values: z.input<typeof note>, correctionSourceId?: string, review?: ReviewReceipt) {
	const input = note.parse(values);
	if (!anchorIsValid(input))
		throw new Error('Excerpt must match the exact source text and offsets.');
	await activeSubjects(tx, input.subjectIds);
	if (
		input.speakerId &&
		!(await tx.foundationSubject.findFirst({
			where: { id: input.speakerId, kind: 'PERSON', state: 'ACTIVE' },
			select: { id: true }
		}))
	)
		throw new FoundationDenied();
	const custody = scope(access);
	const ingestKey = mac(access, 'note-key', input.key);
	const replay = mac(access, 'note-request', JSON.stringify(input));
	let source = await tx.foundationSource.findFirst({
		where: correctionSourceId ? { id: correctionSourceId } : { ingestKey }
	});
	if (correctionSourceId && !source) throw new FoundationDenied();
	if (
		source &&
		(source.state !== 'ACTIVE' || source.kind !== (input.captureKind ?? 'OWNER_NOTE'))
	)
		throw new FoundationDenied();
	if (!source) {
		if (input.expectedVersion !== 0) throw new FoundationConflict();
		source = await tx.foundationSource.create({
			data: { ...custody, kind: input.captureKind ?? 'OWNER_NOTE', ingestKey }
		});
	}
	const latest = await tx.foundationSourceVersion.findFirst({
		where: { sourceId: source.id },
		orderBy: { version: 'desc' }
	});
	if (correctionSourceId) {
		// The editor owns only single-person private notes, not shared or attributed evidence.
		if (!latest || latest.version !== input.expectedVersion) throw new FoundationConflict();
		if (input.subjectIds.length !== 1 ||
			!await editablePersonNote(tx, access, latest, input.subjectIds[0])) throw new FoundationDenied();
	}
	if ((latest?.version ?? 0) !== input.expectedVersion) {
		const prior = await tx.foundationSourceVersion.findFirst({
			where: { sourceId: source.id, version: input.expectedVersion + 1 }
		});
		if (
			prior &&
			JSON.parse(
				decrypt(
					prior.provenanceEnc,
					aad(access, 'FoundationSourceVersion', 'provenanceEnc', prior.id)
				)
			).replay === replay
		) {
			const segment = await tx.foundationEvidenceSegment.findFirst({
				where: { sourceVersionId: prior.id },
				select: { id: true }
			});
			if (!segment) throw new FoundationDenied();
			return { sourceId: source.id, version: prior.version, segmentId: segment.id };
		}
		throw new FoundationConflict();
	}
	const versionId = randomUUID();
	const admission = input.allowPrivateAnalysis ? 'PRIVATE_ANALYSIS' : 'STORED_ONLY';
	const contentMac = mac(access, 'content', input.text);
	const version = await tx.foundationSourceVersion.create({
		data: {
			...custody,
			id: versionId,
			sourceId: source.id,
			...lineage(latest),
			recordedByKind: 'OWNER',
			occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
			processingAdmission: admission,
			contentMac,
			payloadEnc: encrypt(
				input.text,
				aad(access, 'FoundationSourceVersion', 'payloadEnc', versionId)
			),
			provenanceEnc: encrypt(
				JSON.stringify({
					actor: access.actorId,
					admission,
					replay,
					...(review ? { review } : {}),
					...(input.summary !== undefined ? { reviewedSummary: input.summary } : {})
				}),
				aad(access, 'FoundationSourceVersion', 'provenanceEnc', versionId)
			)
		}
	});
	const segmentId = await recordEvidenceSegment(tx, access, versionId, contentMac, input.start, input.end,
		input.quote, input.subjectIds, input.speakerId);
	return { sourceId: source.id, version: version.version, segmentId };
}


function noteProvenance(access: FoundationAccess, version: { id: string; provenanceEnc: string }) {
	return JSON.parse(decrypt(version.provenanceEnc, aad(access, 'FoundationSourceVersion', 'provenanceEnc', version.id)));
}

async function editablePersonNote(tx: AppTransactionClient, access: FoundationAccess,
	version: { id: string; processingAdmission: string; provenanceEnc: string }, personId: string) {
	const limit = version.processingAdmission === 'STORED_ONLY' ? 1 : noteProvenance(access, version).review ? 7 : 0;
	if (!limit) return false;
	const segments = await tx.foundationEvidenceSegment.findMany({
		where: { sourceVersionId: version.id }, take: limit + 1,
		select: { id: true, speakerSubjectId: true }
	});
	if (!segments.length || segments.length > limit || segments.some(segment => segment.speakerSubjectId)) return false;
	const links = await tx.foundationEvidenceSubject.findMany({
		where: { segmentId: { in: segments.map(segment => segment.id) } }, take: limit + 1,
		select: { segmentId: true, subjectId: true }
	});
	return links.length === segments.length && links.every(link => link.subjectId === personId);
}

// A segment projection cannot traverse to parent payload, even when an earlier version is inspected.
export async function segmentState(
	tx: AppTransactionClient,
	segmentId: string,
	forUnderstanding: boolean
) {
	const segment = await tx.foundationEvidenceSegment.findFirst({ where: { id: segmentId } });
	if (!segment) throw new FoundationDenied();
	const version = await tx.foundationSourceVersion.findFirst({
		where: { id: segment.sourceVersionId },
		select: { sourceId: true, version: true, processingAdmission: true }
	});
	if (!version) throw new FoundationDenied();
	const source = await tx.foundationSource.findFirst({
		where: { id: version.sourceId, state: 'ACTIVE' }, select: { kind: true }
	});
	if (!source) throw new FoundationDenied();
	if (forUnderstanding) {
		const latest = await tx.foundationSourceVersion.findFirst({
			where: { sourceId: version.sourceId },
			orderBy: { version: 'desc' },
			select: { version: true }
		});
		if (version.processingAdmission !== 'PRIVATE_ANALYSIS' || latest?.version !== version.version)
			throw new FoundationDenied();
	}
	const links = await tx.foundationEvidenceSubject.findMany({
		where: { segmentId },
		select: { subjectId: true },
		take: 33
	});
	if (links.length > 32) throw new FoundationDenied();
	const subjectIds = links.map((l) => l.subjectId);
	if (source.kind === 'IMPORTED_CONVERSATION') {
		// Conversation anchors use the source's person binding. They do not add rows
		// to the ordinary note history index for each supported passage.
		const presentation = await tx.foundationSourcePresentationVersion.findFirst({
			where: { sourceId: version.sourceId, version: 1 }, select: { subjectId: true }
		});
		if (presentation) subjectIds.push(presentation.subjectId);
	}
	await activeSubjects(tx, [
		...new Set([...subjectIds, ...(segment.speakerSubjectId ? [segment.speakerSubjectId] : [])])
	]);
	return { segment, subjectIds: [...new Set(subjectIds)] };
}
export function readEvidenceSegment(access: FoundationAccess, segmentId: string) {
	return withFoundationAccess(access, 'READ_SEGMENT', async (tx) => {
		const { segment, subjectIds } = await segmentState(tx, id.parse(segmentId), false);
		const anchor = JSON.parse(
			decrypt(segment.anchorEnc, aad(access, 'FoundationEvidenceSegment', 'anchorEnc', segment.id))
		);
		return {
			id: segment.id,
			excerpt: decrypt(
				segment.excerptEnc,
				aad(access, 'FoundationEvidenceSegment', 'excerptEnc', segment.id)
			),
			start: anchor.start,
			end: anchor.end,
			encoding: anchor.encoding,
			...(anchor.turnId ? { turnId: anchor.turnId, speakerRole: anchor.speakerRole } : {}),
			speakerId: segment.speakerSubjectId,
			subjectIds
		};
	});
}
async function checkPerspective(tx: AppTransactionClient, perspectiveId: string) {
	const perspective = await tx.foundationPerspective.findFirst({
		where: { id: perspectiveId },
		select: { kind: true, holderSubjectId: true }
	});
	if (!perspective) throw new FoundationDenied();
	if (perspective.holderSubjectId) await activeSubjects(tx, [perspective.holderSubjectId]);
	return perspective;
}
export function appendSupportedStatement(
	access: FoundationAccess,
	values: z.input<typeof statement>
) {
	return withFoundationAccess(access, 'RECORD_STATEMENT', (tx) => recordSupportedStatement(tx, access, values));
}

async function recordSupportedStatement(tx: AppTransactionClient, access: FoundationAccess, values: z.input<typeof statement>) {
	const input = statement.parse(values);
	const { segment } = await segmentState(tx, input.segmentId, true);
	await activeSubjects(tx, input.subjectIds);
	const perspective = await checkPerspective(tx, input.perspectiveId);
	if (perspective.kind === 'AI_INTERPRETATION' && input.mode !== 'INFERRED')
		throw new FoundationDenied();
	if (input.mode === 'DECLARED') {
		// Attribution is recorded by the owner. A declaration needs a named, matching speaker.
		const speaker =
			perspective.kind === 'OWNER_RECORDED'
				? (
						await tx.foundationSubject.findFirst({
							where: { selfUserId: access.ownerUserId, state: 'ACTIVE' },
							select: { id: true }
						})
					)?.id
				: perspective.holderSubjectId;
		if (!speaker || speaker !== segment.speakerSubjectId) throw new FoundationDenied();
	}
	const statementId = scopedId(access, 'statement-key', input.key);
	const replay = mac(access, 'statement-request', JSON.stringify(input));
	const custody = scope(access);
	const root = await tx.foundationStatement.findFirst({ where: { id: statementId } });
	if (root && (root.perspectiveId !== input.perspectiveId || root.state !== 'ACTIVE'))
		throw new FoundationDenied();
	if (!root) {
		if (input.expectedVersion !== 0) throw new FoundationConflict();
		await tx.foundationStatement.create({
			data: { ...custody, id: statementId, perspectiveId: input.perspectiveId }
		});
	}
	const latest = await tx.foundationStatementVersion.findFirst({
		where: { statementId },
		orderBy: { version: 'desc' }
	});
	if ((latest?.version ?? 0) !== input.expectedVersion) {
		const prior = await tx.foundationStatementVersion.findFirst({
			where: { statementId, version: input.expectedVersion + 1 }
		});
		if (
			prior &&
			JSON.parse(
				decrypt(
					prior.provenanceEnc,
					aad(access, 'FoundationStatementVersion', 'provenanceEnc', prior.id)
				)
			).replay === replay
		)
			return { statementId, version: prior.version };
		throw new FoundationConflict();
	}
	const versionId = randomUUID();
	const version = await tx.foundationStatementVersion.create({
		data: {
			...custody,
			id: versionId,
			statementId,
			...lineage(latest),
			mode: input.mode,
			confidence: input.confidence,
			textEnc: encrypt(
				input.text,
				aad(access, 'FoundationStatementVersion', 'textEnc', versionId)
			),
			provenanceEnc: encrypt(
				JSON.stringify({ actor: access.actorId, replay }),
				aad(access, 'FoundationStatementVersion', 'provenanceEnc', versionId)
			)
		}
	});
	for (const subjectId of input.subjectIds)
		await tx.foundationStatementSubject.create({
			data: { ...custody, statementVersionId: versionId, subjectId }
		});
	await tx.foundationSupport.create({
		data: { ...custody, outputVersionId: versionId, segmentId: segment.id, relation: 'SUPPORTS' }
	});
	return { statementId, version: version.version };
}


export function readCurrentStatement(access: FoundationAccess, statementId: string) {
	return withFoundationAccess(access, 'READ_STATEMENT', async (tx) => {
		const root = await tx.foundationStatement.findFirst({
			where: { id: id.parse(statementId), state: 'ACTIVE' }
		});
		if (!root) throw new FoundationDenied();
		await checkPerspective(tx, root.perspectiveId);
		const version = await tx.foundationStatementVersion.findFirst({
			where: { statementId },
			orderBy: { version: 'desc' }
		});
		if (!version) throw new FoundationDenied();
		const edges = await tx.foundationSupport.findMany({
			where: { outputVersionId: version.id },
			take: 2
		});
		// This stage admits one direct evidence segment. Other graph shapes need their own eligibility checks.
		if (edges.length !== 1 || !edges[0].segmentId || edges[0].relation !== 'SUPPORTS')
			throw new FoundationDenied();
		await segmentState(tx, edges[0].segmentId, true);
		const links = await tx.foundationStatementSubject.findMany({
			where: { statementVersionId: version.id },
			take: 33
		});
		if (links.length > 32) throw new FoundationDenied();
		const subjectIds = links.map((l) => l.subjectId);
		await activeSubjects(tx, subjectIds);
		return {
			statementId,
			version: version.version,
			text: decrypt(
				version.textEnc,
				aad(access, 'FoundationStatementVersion', 'textEnc', version.id)
			),
			mode: version.mode,
			confidence: version.confidence,
			perspectiveId: root.perspectiveId,
			subjectIds
		};
	});
}

// Full note retrieval is a separate owner operation. Segment-only authority still cannot read parent text.
export function listPersonNotes(access: FoundationAccess, personId: string, after?: string) {
	return withFoundationAccess(access, 'READ_NOTES', async (tx) => {
		if (
			!(await tx.foundationSubject.findFirst({
				where: { id: personId, kind: 'PERSON', state: 'ACTIVE', selfUserId: null },
				select: { id: true }
			}))
		)
			throw new FoundationDenied();
		const cursor = after
			? await tx.foundationEvidenceSubject.findFirst({
					where: { id: after, subjectId: personId },
					select: { id: true, createdAt: true }
				})
			: null;
		if (after && !cursor) throw new FoundationDenied();
		const links = await tx.foundationEvidenceSubject.findMany({
			where: {
				subjectId: personId,
				...(cursor
					? {
							OR: [
								{ createdAt: { lt: cursor.createdAt } },
								{ createdAt: cursor.createdAt, id: { lt: cursor.id } }
							]
						}
					: {})
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			take: 51,
			select: { id: true, segmentId: true }
		});
		// Batch the bounded page so remote databases do not require one round trip per edge.
		const segments = await tx.foundationEvidenceSegment.findMany({
			where: { id: { in: links.slice(0, 50).map((link) => link.segmentId) } },
			select: { id: true, sourceVersionId: true, speakerSubjectId: true }
		});
		const versions = await tx.foundationSourceVersion.findMany({
			where: { id: { in: segments.map((segment) => segment.sourceVersionId) } }
		});
		const sources = await tx.foundationSource.findMany({
			where: {
				id: { in: versions.map((version) => version.sourceId) },
				kind: { in: ['OWNER_NOTE', 'VOICE_NOTE'] },
				state: 'ACTIVE'
			},
			select: { id: true, kind: true }
		});
		const currentVersions = new Map<string, number>();
		for (const source of sources) {
			// Bounded point lookups avoid loading an unbounded correction history.
			const latest = await tx.foundationSourceVersion.findFirst({
				where: { sourceId: source.id },
				orderBy: { version: 'desc' },
				select: { version: true }
			});
			if (latest) currentVersions.set(source.id, latest.version);
		}
		const current = segments.filter((segment) => {
			const version = versions.find((version) => version.id === segment.sourceVersionId);
			return version && currentVersions.get(version.sourceId) === version.version;
		});
		const associations = await tx.foundationEvidenceSubject.findMany({
			where: { segmentId: { in: current.map((segment) => segment.id) } },
			select: { subjectId: true, segmentId: true },
			take: 1601
		});
		// Preserve lifecycle checks for every subject/speaker, not only the person whose page is open.
		if (associations.length > 1600) throw new FoundationDenied();
		// An empty history has no evidence subjects to validate; the page person was checked above.
		if (current.length)
			await activeSubjects(tx, [
				...new Set([
					...associations.map((link) => link.subjectId),
					...current.flatMap((segment) =>
						segment.speakerSubjectId ? [segment.speakerSubjectId] : []
					)
				])
			]);
		const notes = [];
		const seen = new Set<string>();
		for (const link of links.slice(0, 50)) {
			const segment = current.find((segment) => segment.id === link.segmentId);
			const version = versions.find((version) => version.id === segment?.sourceVersionId);
			if (!version || seen.has(version.sourceId)) continue;
			const source = sources.find((source) => source.id === version.sourceId);
			if (!source) continue;
			seen.add(source.id);
			const provenance = JSON.parse(
				decrypt(
					version.provenanceEnc,
					aad(access, 'FoundationSourceVersion', 'provenanceEnc', version.id)
				)
			);
			notes.push({
				id: source.id,
				version: version.version,
				editable: provenance.review ? await editablePersonNote(tx, access, version, personId) :
					version.processingAdmission === 'STORED_ONLY' && !segment?.speakerSubjectId &&
					current.filter((item) => item.sourceVersionId === version.id).length === 1 &&
					associations.filter((link) => link.segmentId === segment?.id).length === 1,
				channel: source.kind === 'VOICE_NOTE' ? 'OWNER_VOICE_NOTE' : 'OWNER_NOTE',
				at: (version.occurredAt ?? version.createdAt).toISOString(),
				text: decrypt(
					version.payloadEnc,
					aad(access, 'FoundationSourceVersion', 'payloadEnc', version.id)
				),
				summary: typeof provenance.reviewedSummary === 'string' ? provenance.reviewedSummary : ''
			});
		}
		return { notes, next: links.length > 50 ? links[49].id : null };
	});
}

// Read the latest eligible revision of exactly the owner note linked to the route person.
async function currentReviewNote(tx: AppTransactionClient, access: FoundationAccess, personId: string, sourceId: string) {
	const person = await tx.foundationSubject.findFirst({
		where: { id: personId, kind: 'PERSON', state: 'ACTIVE', selfUserId: null }, select: { id: true }
	});
	if (!person) throw new FoundationDenied();
	const source = await tx.foundationSource.findFirst({
		where: { id: sourceId, kind: { in: ['OWNER_NOTE', 'VOICE_NOTE'] }, state: 'ACTIVE' },
		select: { id: true, kind: true }
	});
	if (!source) throw new FoundationDenied();
	const version = await tx.foundationSourceVersion.findFirst({
		where: { sourceId }, orderBy: { version: 'desc' }
	});
	if (!version || !await editablePersonNote(tx, access, version, personId)) throw new FoundationDenied();
	const provenance = noteProvenance(access, version);
	return {
		version: version.version,
		text: decrypt(version.payloadEnc, aad(access, 'FoundationSourceVersion', 'payloadEnc', version.id)),
		summary: typeof provenance.reviewedSummary === 'string' ? provenance.reviewedSummary : undefined,
		at: (version.occurredAt ?? version.createdAt).toISOString(),
		kind: source.kind === 'VOICE_NOTE' ? 'VOICE_NOTE' as const : 'OWNER_NOTE' as const,
		review: provenance.review as ReviewReceipt | undefined
	};
}

export function readNoteForReview(access: FoundationAccess, personId: string, sourceId: string) {
	return withFoundationAccess(access, 'READ_NOTES', (tx) => currentReviewNote(tx, access, personId, sourceId));
}

export function approveNoteReview(access: FoundationAccess, personId: string, sourceId: string,
	expectedVersion: number, selected: NoteReviewProposal[]) {
	return withFoundationAccess(access, 'REVIEW_NOTE', async (tx) => {
		const proposals = reviewProposals.min(1).parse(selected);
		const current = await currentReviewNote(tx, access, personId, sourceId);
		const key = mac(access, 'note-review', JSON.stringify([sourceId, expectedVersion, proposals]));
		if (current.review?.key === key) return; // An identical submission already committed.
		if (current.review || current.version !== expectedVersion) throw new FoundationConflict();
		const anchors = proposals.map((proposal, index) => {
			const start = current.text.indexOf(proposal.quote);
			const end = start + proposal.quote.length;
			if (start < 0 || splitsPair(current.text, start) || splitsPair(current.text, end))
				throw new FoundationDenied();
			return { start, end, key: 'note-review:' + key + ':' + index, proposal };
		});

		const custody = scope(access);
		const self = await tx.foundationSubject.findFirst({
			where: { selfUserId: access.ownerUserId, kind: 'PERSON', state: 'ACTIVE' }, select: { id: true }
		});
		if (!self) throw new FoundationDenied();
		const existingPerspective = await tx.foundationPerspective.findFirst({
			where: { kind: 'OWNER_RECORDED', holderSubjectId: null }, orderBy: { id: 'asc' }, select: { id: true }
		});
		const perspective = existingPerspective ?? await tx.foundationPerspective.create({
			data: { ...custody, kind: 'OWNER_RECORDED' }, select: { id: true }
		});

		// This workflow has a default private reference for the pair. Other relationship types
		// can keep distinct subjects without a global uniqueness rule on participants.
		const relationshipId = scopedId(access, 'note-review-relationship', personId);
		if (proposals.some(proposal => proposal.bucket === 'relationship')) {
			const existing = await tx.foundationSubject.findFirst({
				where: { id: relationshipId }, select: { state: true, kind: true }
			});
			if (existing && (existing.state !== 'ACTIVE' || existing.kind !== 'RELATIONSHIP'))
				throw new FoundationDenied();
			if (!existing)
				await insertRelationship(tx, custody, 'Our relationship', [self.id, personId], 'RELATIONSHIP', relationshipId);
		}

		// Record consent, exact supporting passages and all selected statements in one transaction.
		const first = anchors[0];
		const receipt = { key, entries: anchors.map(anchor => ({
			bucket: anchor.proposal.bucket, statementId: scopedId(access, 'statement-key', anchor.key),
			start: anchor.start, end: anchor.end
		})) };
		const admitted = await recordOwnerNote(tx, access, {
			key, expectedVersion, text: current.text, summary: current.summary, occurredAt: current.at,
			quote: first.proposal.quote, start: first.start, end: first.end,
			subjectIds: [personId], captureKind: current.kind, allowPrivateAnalysis: true
		}, sourceId, receipt);
		const version = await tx.foundationSourceVersion.findFirst({
			where: { sourceId, version: admitted.version }, select: { id: true, contentMac: true }
		});
		if (!version) throw new FoundationDenied();
		const segments = new Map([[first.start + ':' + first.end, admitted.segmentId]]);
		for (const anchor of anchors) {
			const position = anchor.start + ':' + anchor.end;
			const segmentId = segments.get(position) ?? await recordEvidenceSegment(tx, access, version.id,
				version.contentMac, anchor.start, anchor.end, anchor.proposal.quote, [personId]);
			segments.set(position, segmentId);
			const subjectId = { self: self.id, person: personId, relationship: relationshipId }[anchor.proposal.bucket];
			await recordSupportedStatement(tx, access, {
				key: anchor.key, expectedVersion: 0, text: anchor.proposal.text, segmentId,
				subjectIds: [subjectId], perspectiveId: perspective.id, mode: anchor.proposal.mode,
				confidence: anchor.proposal.mode === 'INFERRED' ? 'LOW' : 'MEDIUM'
			});
		}
	});
}
