// Pure wire contracts for LU preparation. Parsed packets are data, never Foundation capabilities.
// Callers must resolve current authority before reading, processing, approving or persisting.
import { z } from 'zod';

const id = z
	.string()
	.min(1)
	.max(200)
	.refine((value) => value.trim() === value && value.length > 0);
const instant = z.iso.datetime({ offset: true }).nullable();
export const contentKinds = [
	'FACT',
	'OBJECTIVE',
	'WANT',
	'OFFER',
	'PREFERENCE',
	'CONSTRAINT',
	'RELATIONSHIP_STATE',
	'OTHER'
] as const;
export const epistemicBases = [
	'DIRECT_ACCOUNT',
	'REPORTED_ASSERTION',
	'EXPRESSED_OPINION',
	'MODEL_INFERENCE',
	'UNRESOLVED'
] as const;
export const topicEffects = [
	'UNCHANGED',
	'REINFORCED',
	'REFINED',
	'EXPANDED',
	'QUALIFIED',
	'CONTRADICTED',
	'SUPERSEDED',
	'NEW'
] as const;

const destinationSchema = z.strictObject({ subjectId: id, perspectiveId: id });
const baselineTopicSchema = z.strictObject({
	topicId: id,
	versionId: id,
	meaningVersionIds: z.array(id)
});
const sourcePacketSchema = z.strictObject({
	contract: z.literal('LUR-1'),
	scope: z.strictObject({
		ownerUserId: id,
		vaultId: id,
		epoch: z.number().int().nonnegative(),
		selfSubjectId: id
	}),
	source: z.strictObject({
		id,
		versionId: id,
		version: z.number().int().positive(),
		contentMac: id,
		kind: z.enum(['OWNER_NOTE', 'VOICE_NOTE', 'IMPORTED_CONVERSATION']),
		occurredAt: instant,
		completeness: z.enum(['COMPLETE', 'INCOMPLETE']),
		admission: z.enum(['STORED_ONLY', 'PRIVATE_ANALYSIS'])
	}),
	// Canonical UTF-16 text is retained whole. Limits reject input; they never truncate it.
	text: z.string().min(1).max(1_000_000),
	subjects: z
		.array(z.strictObject({ id, kind: z.enum(['PERSON', 'RELATIONSHIP', 'GROUP']) }))
		.min(1)
		.max(256),
	destinations: z
		.array(destinationSchema.extend({ perspectiveKind: z.literal('OWNER_RECORDED') }))
		.min(1)
		.max(256),
	speakers: z
		.array(
			z.strictObject({
				id,
				role: z.enum(['OWNER', 'AGENT', 'OTHER', 'UNRESOLVED']),
				subjectId: id.nullable()
			})
		)
		.min(1)
		.max(256),
	turns: z
		.array(
			z.strictObject({
				id,
				speakerId: id,
				start: z.number().int().nonnegative(),
				end: z.number().int().positive()
			})
		)
		.min(1)
		.max(10_000),
	unresolvedMentions: z.array(
		z.strictObject({ turnId: id, text: z.string().min(1), reason: z.string().min(1) })
	),
	baselines: z.array(
		destinationSchema.extend({ revisionId: id.nullable(), topics: z.array(baselineTopicSchema) })
	)
});
export type SourcePacket = z.infer<typeof sourcePacketSchema>;

const evidenceSchema = z.strictObject({
	sourceVersionId: id,
	turnId: id,
	start: z.number().int().nonnegative(),
	end: z.number().int().positive(),
	quote: z.string().min(1),
	role: z.enum(['SUPPORTS', 'QUALIFIES', 'CONTRADICTS', 'CONTEXT'])
});
const meaningSchema = destinationSchema.extend({
	id,
	text: z.string().min(1).max(6500),
	kind: z.enum(contentKinds),
	basis: z.enum(epistemicBases),
	expressedUncertainty: z.string().min(1).nullable(),
	confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
	speakerId: id,
	asserter: z.strictObject({
		kind: z.enum(['SOURCE_SPEAKER', 'REPORTED_PERSON', 'MODEL', 'UNRESOLVED']),
		referenceId: id.nullable()
	}),
	generation: z.strictObject({
		kind: z.enum(['HUMAN_AUTHORED', 'MODEL_DRAFTED', 'HUMAN_EDITED_MODEL_DRAFT']),
		invocationId: id.nullable(),
		model: id.nullable(),
		promptVersion: id.nullable(),
		pipelineVersion: id
	}),
	recorder: z.enum(['OWNER', 'VISITOR', 'SERVICE']),
	// A model cannot manufacture an approval event. Review is stored separately against exact versions.
	review: z.literal('UNREVIEWED'),
	observedAt: instant,
	validFrom: instant,
	validUntil: instant,
	evidence: z.array(evidenceSchema).min(1)
});
const candidateSchema = z.strictObject({
	contract: z.literal('LUR-1'),
	sourceVersionId: id,
	sourceContentMac: id,
	meanings: z.array(meaningSchema).max(2000),
	streams: z
		.array(
			destinationSchema.extend({
				baselineRevisionId: id.nullable(),
				topics: z
					.array(
						z.strictObject({
							key: id,
							topicId: id.nullable(),
							previousVersionId: id.nullable(),
							effect: z.enum(topicEffects),
							area: z.string().min(1),
							title: z.string().min(1),
							prose: z.string().min(1).max(6500),
							timeScope: z.enum(['CURRENT', 'HISTORICAL', 'MIXED']),
							meaningIds: z.array(id),
							contextualMeaningIds: z.array(id).optional(),
							retainedMeaningVersionIds: z.array(id),
							retiredMeanings: z.array(z.strictObject({ versionId: id, reason: z.string().min(1) }))
						})
					)
					.min(1)
					.max(256)
			})
		)
		.max(256),
	// Coverage is an assessment artefact, not proof that every meaning in free text was found.
	exclusions: z.array(z.strictObject({ turnId: id, reason: z.string().min(1) }))
});
export type UnderstandingCandidate = z.infer<typeof candidateSchema>;

function ensure(condition: unknown, code: string): asserts condition {
	// Fixed errors deliberately omit private source/model content.
	if (!condition) throw new Error(`LU contract: ${code}`);
}
function unique(values: string[]) {
	return new Set(values).size === values.length;
}
function key(d: { subjectId: string; perspectiveId: string }) {
	return JSON.stringify([d.subjectId, d.perspectiveId]);
}
function boundary(text: string, offset: number) {
	// JS offsets use UTF-16; reject an anchor splitting an emoji/surrogate pair.
	return !(
		offset > 0 &&
		offset < text.length &&
		/[\uD800-\uDBFF]/.test(text[offset - 1]) &&
		/[\uDC00-\uDFFF]/.test(text[offset])
	);
}

export function parseSourcePacket(raw: unknown): SourcePacket {
	const p = sourcePacketSchema.parse(raw);
	ensure(
		unique(p.subjects.map((s) => s.id)) &&
			unique(p.speakers.map((s) => s.id)) &&
			unique(p.turns.map((t) => t.id)),
		'duplicate_reference'
	);
	const subjects = new Map(p.subjects.map((s) => [s.id, s.kind]));
	ensure(subjects.get(p.scope.selfSubjectId) === 'PERSON', 'self_subject');
	ensure(
		unique(p.destinations.map(key)) && p.destinations.every((d) => subjects.has(d.subjectId)),
		'destination'
	);
	ensure(
		unique(p.baselines.map(key)) &&
			p.baselines.length === p.destinations.length &&
			p.baselines.every((b) => p.destinations.some((d) => key(d) === key(b))),
		'baseline_manifest'
	);
	for (const b of p.baselines) {
		ensure(
			(b.revisionId !== null || b.topics.length === 0) && unique(b.topics.map((t) => t.topicId)),
			'baseline_topics'
		);
		for (const t of b.topics) ensure(unique(t.meaningVersionIds), 'baseline_meanings');
	}
	for (const s of p.speakers) {
		ensure(s.subjectId === null || subjects.get(s.subjectId) === 'PERSON', 'speaker_subject');
		ensure(!['AGENT', 'UNRESOLVED'].includes(s.role) || s.subjectId === null, 'nonhuman_subject');
		ensure(s.role !== 'OWNER' || s.subjectId === p.scope.selfSubjectId, 'owner_speaker');
	}
	const speakers = new Set(p.speakers.map((s) => s.id));
	let end = 0;
	for (const t of p.turns) {
		ensure(
			speakers.has(t.speakerId) &&
				t.start >= end &&
				t.end > t.start &&
				t.end <= p.text.length &&
				boundary(p.text, t.start) &&
				boundary(p.text, t.end),
			'turn_anchor'
		);
		ensure(!p.text.slice(end, t.start).trim(), 'unlabelled_source_text');
		end = t.end;
	}
	ensure(!p.text.slice(end).trim(), 'unlabelled_source_text');
	ensure(
		p.unresolvedMentions.every((m) =>
			p.turns.some((t) => t.id === m.turnId && p.text.slice(t.start, t.end).includes(m.text))
		),
		'unresolved_mention'
	);
	return p;
}

export function parseCandidate(raw: unknown, packet: SourcePacket): UnderstandingCandidate {
	// Reparse even typed input: serialization and TS types provide no runtime assurance.
	const p = parseSourcePacket(packet);
	const c = candidateSchema.parse(raw);
	ensure(
		p.source.admission === 'PRIVATE_ANALYSIS' && p.source.completeness === 'COMPLETE',
		'source_not_ready'
	);
	ensure(
		c.sourceVersionId === p.source.versionId && c.sourceContentMac === p.source.contentMac,
		'source_binding'
	);
	ensure(unique(c.meanings.map((m) => m.id)) && unique(c.streams.map(key)), 'duplicate_candidate');
	const destinations = new Set(p.destinations.map(key));
	const turns = new Map(p.turns.map((t) => [t.id, t]));
	const speakers = new Map(p.speakers.map((s) => [s.id, s]));
	const meanings = new Map(c.meanings.map((m) => [m.id, m]));
	for (const m of c.meanings) {
		ensure(destinations.has(key(m)) && speakers.has(m.speakerId), 'meaning_destination');
		ensure(
			m.basis !== 'MODEL_INFERENCE' && m.asserter.kind !== 'MODEL',
			'ai_perspective_not_enabled'
		);
		ensure(
			m.asserter.kind !== 'SOURCE_SPEAKER' || m.asserter.referenceId === m.speakerId,
			'asserter'
		);
		ensure(
			m.asserter.kind !== 'REPORTED_PERSON' ||
				(m.basis === 'REPORTED_ASSERTION' &&
					p.subjects.some((s) => s.id === m.asserter.referenceId && s.kind === 'PERSON')),
			'reported_asserter'
		);
		ensure(m.asserter.kind !== 'UNRESOLVED' || m.asserter.referenceId === null, 'unknown_asserter');
		ensure(
			!['DIRECT_ACCOUNT', 'EXPRESSED_OPINION'].includes(m.basis) ||
				m.asserter.kind === 'SOURCE_SPEAKER',
			'direct_attribution'
		);
		ensure(
			m.basis !== 'REPORTED_ASSERTION' || m.asserter.kind !== 'SOURCE_SPEAKER',
			'reported_asserter'
		);
		ensure(
			m.generation.kind === 'HUMAN_AUTHORED' ||
				Boolean(m.generation.invocationId && m.generation.model && m.generation.promptVersion),
			'generation_provenance'
		);
		ensure(
			!m.validFrom || !m.validUntil || Date.parse(m.validFrom) <= Date.parse(m.validUntil),
			'validity_order'
		);
		let humanSupport = false;
		for (const e of m.evidence) {
			const t = turns.get(e.turnId);
			ensure(
				t &&
					e.sourceVersionId === p.source.versionId &&
					e.start >= t.start &&
					e.end <= t.end &&
					e.end > e.start &&
					boundary(p.text, e.start) &&
					boundary(p.text, e.end) &&
					p.text.slice(e.start, e.end) === e.quote,
				'evidence_anchor'
			);
			ensure(
				e.role === 'CONTEXT' || ['OWNER', 'OTHER'].includes(speakers.get(t.speakerId)!.role),
				'support_speaker'
			);
			if (e.role === 'SUPPORTS') {
				ensure(t.speakerId === m.speakerId, 'support_speaker');
				humanSupport = true;
			}
		}
		ensure(humanSupport, 'missing_support');
	}
	const used = new Set<string>();
	for (const s of c.streams) {
		const b = p.baselines.find((b) => key(b) === key(s));
		ensure(
			destinations.has(key(s)) && b && b.revisionId === s.baselineRevisionId,
			'stale_baseline'
		);
		ensure(
			unique(s.topics.map((t) => t.key)) &&
				unique(s.topics.flatMap((t) => (t.topicId ? [t.topicId] : []))),
			'duplicate_topic'
		);
		for (const t of s.topics) {
			const prior = b.topics.find((prior) => prior.topicId === t.topicId);
			ensure(
				t.effect === 'NEW'
					? t.topicId === null && t.previousVersionId === null
					: prior && t.previousVersionId === prior.versionId,
				'topic_lineage'
			);
			ensure(
				unique(t.meaningIds) &&
					unique(t.retainedMeaningVersionIds) &&
					unique(t.retiredMeanings.map((r) => r.versionId)),
				'duplicate_meaning'
			);
			const contextual = t.contextualMeaningIds ?? [];
			ensure(
				unique(contextual) && contextual.every((id) => t.meaningIds.includes(id)),
				'contextual_meaning'
			);
			for (const meaningId of t.meaningIds) {
				const meaning = meanings.get(meaningId);
				ensure(meaning && key(meaning) === key(s), 'topic_meaning');
				used.add(meaningId);
			}
			const accounted = [
				...t.retainedMeaningVersionIds,
				...t.retiredMeanings.map((r) => r.versionId)
			];
			ensure(
				unique(accounted) &&
					accounted.every((id) => prior?.meaningVersionIds.includes(id)) &&
					(prior?.meaningVersionIds ?? []).every((id) => accounted.includes(id)),
				'inherited_meaning_coverage'
			);
			ensure(
				t.effect !== 'UNCHANGED' || (!t.meaningIds.length && !t.retiredMeanings.length),
				'unchanged_mutation'
			);
			ensure(t.effect === 'UNCHANGED' || t.meaningIds.length > 0, 'changed_without_evidence');
		}
		ensure(
			b.topics.every((t) => s.topics.some((next) => next.topicId === t.topicId)),
			'omitted_baseline_topic'
		);
	}
	ensure(
		c.meanings.every((m) => used.has(m.id)),
		'orphan_meaning'
	);
	ensure(
		c.exclusions.every((e) => turns.has(e.turnId)),
		'exclusion_turn'
	);
	return c;
}
