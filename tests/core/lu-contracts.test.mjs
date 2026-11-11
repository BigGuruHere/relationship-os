// These are executable contract tests, not a live model-quality or persistence evaluation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as legacy from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';
import * as shared from '../../src/lib/server/livingUnderstanding/revisionPolicy.mjs';
import {
	parseSourcePacket,
	parseCandidate
} from '../../src/lib/server/livingUnderstanding/contracts.ts';
import {
	describeLegacyTaxonomy,
	legacyTaxonomySchema
} from '../../src/lib/server/livingUnderstanding/legacyTaxonomy.ts';
import {
	initialFixture,
	initialExpectations,
	secondConversation
} from './fixtures/lu/conversations.mjs';

test('legacy callers and the shared module use the same validator exports', () => {
	assert.deepEqual(Object.keys(legacy), Object.keys(shared));
	for (const name of Object.keys(shared)) assert.equal(legacy[name], shared[name]);
});

test('rich initial contract retains all nine labelled topics, attribution and temporal scopes', () => {
	const { packet, candidate } = initialFixture();
	const result = parseCandidate(candidate, parseSourcePacket(packet));
	assert.equal(result.streams.flatMap((s) => s.topics).length, 9);
	assert.equal(new Set(initialExpectations.map((e) => e[1])).size, 4);
	assert.deepEqual(result, candidate);
	assert.equal(result.meanings[3].basis, 'EXPRESSED_OPINION');
	assert.equal(result.meanings[4].asserter.referenceId, 'alex');
	assert.equal(result.meanings[0].generation.kind, 'MODEL_DRAFTED');
	assert.equal(result.meanings[0].asserter.referenceId, 'owner');
	assert.deepEqual(
		new Set(secondConversation.map((c) => c.effect)),
		new Set(shared.LONGITUDINAL_EFFECTS.concat('NEW'))
	);
});

for (const [name, mutate] of [
	[
		'invented subject',
		(c) => {
			c.meanings[0].subjectId = 'unknown';
		}
	],
	[
		'invented perspective',
		(c) => {
			c.meanings[0].perspectiveId = 'other';
		}
	],
	[
		'wrong source version',
		(c) => {
			c.sourceVersionId = 'stale';
		}
	],
	[
		'wrong source MAC',
		(c) => {
			c.sourceContentMac = 'stale';
		}
	],
	[
		'unsupported quote',
		(c) => {
			c.meanings[0].evidence[0].quote = 'Invented';
		}
	],
	[
		'wrong turn',
		(c) => {
			c.meanings[0].evidence[0].turnId = 'T999';
		}
	],
	[
		'model supplied approval',
		(c) => {
			c.meanings[0].review = 'APPROVED';
		}
	],
	[
		'unbound asserter',
		(c) => {
			c.meanings[0].asserter.referenceId = 'agent';
		}
	],
	[
		'agent assertion as human evidence',
		(c) => {
			c.meanings[0].speakerId = 'agent';
			c.meanings[0].asserter.referenceId = 'agent';
		}
	],
	[
		'AI hypothesis outside enabled scope',
		(c) => {
			c.meanings[0].basis = 'MODEL_INFERENCE';
		}
	],
	[
		'missing generation metadata',
		(c) => {
			c.meanings[0].generation.invocationId = null;
		}
	],
	[
		'duplicated meaning',
		(c) => {
			c.meanings.push(c.meanings[0]);
		}
	],
	[
		'orphan meaning',
		(c) => {
			c.streams[0].topics.shift();
		}
	],
	[
		'cross-stream meaning',
		(c) => {
			c.streams[1].topics[0].meaningIds = ['M0'];
		}
	],
	[
		'stale baseline',
		(c) => {
			c.streams[0].baselineRevisionId = 'old';
		}
	],
	[
		'inverted validity',
		(c) => {
			c.meanings[0].validFrom = '2026-11-02T00:00:00Z';
			c.meanings[0].validUntil = '2026-11-01T00:00:00Z';
		}
	]
])
	test(`candidate rejects ${name}`, () => {
		const { packet, candidate } = initialFixture();
		mutate(candidate);
		assert.throws(() => parseCandidate(candidate, packet));
	});

test('stored-only and incomplete sources can be represented but cannot produce ready candidates', () => {
	for (const change of [{ admission: 'STORED_ONLY' }, { completeness: 'INCOMPLETE' }]) {
		const { packet, candidate } = initialFixture();
		Object.assign(packet.source, change);
		assert.ok(parseSourcePacket(packet));
		assert.throws(() => parseCandidate(candidate, packet), /source_not_ready/);
	}
});

test('a question can be context for a human affirmation without becoming human support', () => {
	const { packet, candidate } = initialFixture();
	const m = candidate.meanings[0];
	const affirmation = packet.turns[13];
	const question = packet.turns[12];
	m.evidence = [affirmation, question].map((t, i) => ({
		sourceVersionId: 'source-v1',
		turnId: t.id,
		start: t.start,
		end: t.end,
		quote: packet.text.slice(t.start, t.end),
		role: i === 0 ? 'SUPPORTS' : 'CONTEXT'
	}));
	assert.ok(parseCandidate(candidate, packet));
	m.evidence[1].role = 'SUPPORTS';
	assert.throws(() => parseCandidate(candidate, packet), /support_speaker/);
});

test('repeated quotes anchor to exact turns; UTF-16 anchors cannot split emoji', () => {
	const { packet, candidate } = initialFixture();
	packet.text = 'Hello 😀\nHello 😀';
	packet.turns = [
		{ id: 'one', speakerId: 'owner', start: 0, end: 8 },
		{ id: 'two', speakerId: 'owner', start: 9, end: 17 }
	];
	packet.unresolvedMentions = [];
	candidate.exclusions = [];
	for (const m of candidate.meanings)
		m.evidence = [
			{
				sourceVersionId: 'source-v1',
				turnId: 'two',
				start: 9,
				end: 17,
				quote: 'Hello 😀',
				role: 'SUPPORTS'
			}
		];
	assert.ok(parseCandidate(candidate, packet));
	candidate.meanings[0].evidence[0].turnId = 'one';
	assert.throws(() => parseCandidate(candidate, packet), /evidence_anchor/);
	packet.turns[0].end = 7;
	assert.throws(() => parseSourcePacket(packet), /turn_anchor/);
});

test('future fourth subject is representable, unresolved names never create it implicitly', () => {
	const { packet } = initialFixture();
	assert.equal(packet.subjects.length, 3);
	packet.subjects.push({ id: 'morgan', kind: 'PERSON' });
	packet.destinations.push({
		subjectId: 'morgan',
		perspectiveId: 'view-morgan',
		perspectiveKind: 'OWNER_RECORDED'
	});
	packet.baselines.push({
		subjectId: 'morgan',
		perspectiveId: 'view-morgan',
		revisionId: null,
		topics: []
	});
	assert.equal(parseSourcePacket(packet).subjects.length, 4);
	packet.speakers.push({ id: 'fake-agent-person', role: 'AGENT', subjectId: 'morgan' });
	assert.throws(() => parseSourcePacket(packet), /nonhuman_subject/);
});

test('source preparation rejects dropped turns rather than labelling the remaining transcript complete', () => {
	const { packet } = initialFixture();
	packet.turns.splice(2, 1);
	assert.throws(() => parseSourcePacket(packet), /unlabelled_source_text/);
});

test('longitudinal manifest preserves inherited evidence, requires all baseline topics', () => {
	const { packet, candidate } = initialFixture();
	const b = packet.baselines[0];
	const s = candidate.streams[0];
	const t = s.topics[0];
	b.revisionId = s.baselineRevisionId = 'revision-v1';
	b.topics = [
		{ topicId: 'old-topic', versionId: 'topic-v1', meaningVersionIds: ['old-meaning-v1'] }
	];
	t.topicId = 'old-topic';
	t.previousVersionId = 'topic-v1';
	t.effect = 'REINFORCED';
	t.retainedMeaningVersionIds = ['old-meaning-v1'];
	assert.ok(parseCandidate(candidate, packet));
	t.retainedMeaningVersionIds = [];
	assert.throws(() => parseCandidate(candidate, packet), /inherited_meaning_coverage/);
	t.retiredMeanings = [
		{ versionId: 'old-meaning-v1', reason: 'Explicit proposed retirement, subject to review.' }
	];
	assert.ok(parseCandidate(candidate, packet));
	t.effect = 'UNCHANGED';
	assert.throws(() => parseCandidate(candidate, packet), /unchanged_mutation/);
	t.effect = 'NEW';
	t.topicId = t.previousVersionId = null;
	t.retiredMeanings = [];
	assert.throws(() => parseCandidate(candidate, packet), /omitted_baseline_topic/);
});

test('exact legacy taxonomy is retained with conservative attribution hints', () => {
	const base = {
		kind: 'RELATIONSHIP_STATE',
		authority: 'SELF_DECLARED',
		sourceType: 'AGENT',
		perspective: 'OWNER_OBSERVATION',
		status: 'ACTIVE',
		confidence: 'HIGH',
		certainty: 'DIRECT',
		actor: 'DORIAN',
		decision: 'CONFIRMED'
	};
	const result = describeLegacyTaxonomy(base);
	assert.deepEqual(result.legacy, base);
	assert.equal(result.basisHint, 'DIRECT_ACCOUNT_OR_EXPRESSED_OPINION');
	assert.equal(result.requiresAttributionReview, true);
	// Exercise every enum value, including unknown historical authority and all reviewer actors.
	for (const [field, schema] of Object.entries(legacyTaxonomySchema.shape)) {
		const options = schema.options ?? schema.unwrap().options;
		for (const value of options)
			assert.equal(describeLegacyTaxonomy({ ...base, [field]: value }).legacy[field], value);
	}
	assert.throws(() => describeLegacyTaxonomy({ ...base, kind: 'OPINION' }));
});

test('mapping vocabulary covers the complete persisted claim taxonomy', () => {
	const prisma = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
	for (const [field, name] of Object.entries({
		kind: 'KnowledgeClaimKind',
		authority: 'KnowledgeAuthority',
		sourceType: 'KnowledgeSourceType',
		perspective: 'KnowledgePerspective',
		status: 'KnowledgeClaimStatus',
		confidence: 'KnowledgeConfidence'
	})) {
		const body = prisma.match(new RegExp(`enum ${name} \\{([^}]+)\\}`))[1];
		assert.deepEqual(
			new Set(legacyTaxonomySchema.shape[field].options),
			new Set(body.trim().split(/\s+/))
		);
	}
});
