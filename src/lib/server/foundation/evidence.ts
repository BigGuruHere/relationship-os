// Versioned owner evidence. P-303 routes pass explicit owner authority and stored-only admission.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { buildScopedMacToken, encrypt, decrypt } from '$lib/crypto';
import type { AppTransactionClient } from '$lib/db';
import { FoundationDenied } from './internal';
import { withFoundationAccess, type FoundationAccess } from './policy';

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
	summary: z.string().max(20000).optional()
});
const statement = z.strictObject({
	...revision,
	text: z.string().trim().min(1).max(8000),
	perspectiveId: id,
	subjectIds: subjects,
	segmentId: id,
	mode: z.enum(['DECLARED', 'OBSERVED', 'INFERRED']),
	confidence: z.enum(['LOW', 'MEDIUM', 'HIGH'])
});
export class FoundationConflict extends Error {
	constructor() {
		super('The revision or replay key conflicts with saved work.');
	}
}
function scope(a: FoundationAccess) {
	return { ownerUserId: a.ownerUserId, vaultId: a.vaultId };
}
function mac(a: FoundationAccess, purpose: string, value: string) {
	return buildScopedMacToken(value, 'foundation:v1:' + a.vaultId + ':' + purpose);
}
function aad(a: FoundationAccess, table: string, field: string, row: string) {
	return ['foundation', 'v1', table, field, a.ownerUserId, a.vaultId, row].join(':');
}
async function activeSubjects(tx: AppTransactionClient, ids: string[]) {
	const count = await tx.foundationSubject.count({ where: { id: { in: ids }, state: 'ACTIVE' } });
	if (!ids.length || count !== ids.length) throw new FoundationDenied();
}
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
function lineage(previous: { id: string; version: number } | null) {
	return {
		version: (previous?.version ?? 0) + 1,
		previousVersionId: previous?.id ?? null,
		previousVersionNumber: previous?.version ?? null
	};
}

// The F-204 account and vault locks serialize expected-version comparison, replay and all inserts.
export function appendOwnerNote(access: FoundationAccess, values: z.input<typeof note>) {
	return withFoundationAccess(access, 'RECORD_EVIDENCE', async (tx) => {
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
		let source = await tx.foundationSource.findFirst({ where: { ingestKey } });
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
		const versionId = randomUUID(),
			segmentId = randomUUID();
		const admission = input.allowPrivateAnalysis ? 'PRIVATE_ANALYSIS' : 'STORED_ONLY';
		const contentMac = mac(access, 'content', input.text);
		const anchor = JSON.stringify({
			encoding: 'UTF-16',
			start: input.start,
			end: input.end,
			contentMac
		});
		const version = await tx.foundationSourceVersion.create({
			data: {
				...custody,
				id: versionId,
				sourceId: source.id,
				...lineage(latest),
				recordedByKind: 'OWNER',
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
						...(input.summary !== undefined ? { reviewedSummary: input.summary } : {})
					}),
					aad(access, 'FoundationSourceVersion', 'provenanceEnc', versionId)
				)
			}
		});
		await tx.foundationEvidenceSegment.create({
			data: {
				...custody,
				id: segmentId,
				sourceVersionId: versionId,
				speakerSubjectId: input.speakerId,
				speakerKind: input.speakerId ? 'PERSON' : null,
				anchorMac: mac(access, 'anchor:' + versionId, anchor),
				anchorEnc: encrypt(
					anchor,
					aad(access, 'FoundationEvidenceSegment', 'anchorEnc', segmentId)
				),
				excerptEnc: encrypt(
					input.quote,
					aad(access, 'FoundationEvidenceSegment', 'excerptEnc', segmentId)
				)
			}
		});
		for (const subjectId of input.subjectIds)
			await tx.foundationEvidenceSubject.create({ data: { ...custody, segmentId, subjectId } });
		return { sourceId: source.id, version: version.version, segmentId };
	});
}

// A segment projection cannot traverse to parent payload, even when an earlier version is inspected.
async function segmentState(
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
	if (
		!version ||
		!(await tx.foundationSource.findFirst({
			where: { id: version.sourceId, state: 'ACTIVE' },
			select: { id: true }
		}))
	)
		throw new FoundationDenied();
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
	await activeSubjects(tx, [
		...new Set([...subjectIds, ...(segment.speakerSubjectId ? [segment.speakerSubjectId] : [])])
	]);
	return { segment, subjectIds };
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
	return withFoundationAccess(access, 'RECORD_STATEMENT', async (tx) => {
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
		// Stable per-vault opaque root provides retry safety without a new schema field.
		const hash = mac(access, 'statement-key', input.key);
		// An opaque, deterministic UUIDv8 keeps stable subject-domain ID conventions on retries.
		const statementId = [
			hash.slice(0, 8),
			hash.slice(8, 12),
			'8' + hash.slice(13, 16),
			'8' + hash.slice(17, 20),
			hash.slice(20, 32)
		].join('-');
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
	});
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
			select: { subjectId: true },
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
