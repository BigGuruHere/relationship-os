// Synthetic fixtures exercise both Foundation output and the earlier semantic validators.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessConversation } from '../../src/lib/server/livingUnderstanding/semanticAssessment.ts';
import {
	validateLongitudinalAnalysisDraft,
	validateSemanticDecompositionDraft
} from '../../src/lib/server/livingUnderstanding/revisionPolicy.mjs';
import {
	initialFixture,
	initialTurns,
	initialExpectations,
	secondConversation
} from './fixtures/lu/conversations.mjs';

function blankTopic(destination, prior = null, effect = 'NEW') {
	return {
		destination,
		prior,
		effect,
		area: null,
		title: null,
		prose: null,
		timeScope: null,
		primary: [],
		contextual: [],
		retire: []
	};
}
function initialModel() {
	const { packet } = initialFixture();
	const destinations = { self: 'D1', alex: 'D2', relationship: 'D3' };
	const meanings = initialExpectations.map(([subject, area, topic, kind, basis, , i], n) => ({
		id: 'M' + n,
		destination: destinations[subject],
		area,
		topic,
		text: initialTurns[i][1],
		kind,
		basis,
		uncertainty: i === 6 ? 'Unsure about frequency.' : null,
		confidence: 'HIGH',
		evidence: [{ turnId: 'T' + i, quote: initialTurns[i][1], role: 'SUPPORTS' }]
	}));
	meanings.push({
		id: 'confirmation',
		destination: 'D3',
		area: 'Friendships',
		topic: 'Feeling overlooked',
		text: 'The owner feels overlooked when plans fall through.',
		kind: 'OTHER',
		basis: 'DIRECT_ACCOUNT',
		uncertainty: null,
		confidence: 'MEDIUM',
		evidence: [
			{ turnId: 'T12', quote: initialTurns[12][1], role: 'CONTEXT' },
			{ turnId: 'T13', quote: initialTurns[13][1], role: 'SUPPORTS' }
		]
	});
	const topics = meanings.map((m, i) => ({
		...blankTopic(m.destination),
		area: m.area,
		title: m.topic,
		prose: m.text,
		timeScope: initialExpectations[i]?.[5] ?? 'CURRENT',
		primary: [m.id]
	}));
	topics[1].contextual = ['M0'];
	return {
		input: { packet, prior: [] },
		responses: {
			decompose: {
				meanings,
				exclusions: [
					{ turnId: 'T11', reason: 'UNCLEAR' },
					{ turnId: 'T14', reason: 'TEMPORARY' }
				],
				unresolvedMentions: [{ turnId: 'T14', text: 'Morgan' }]
			},
			compose: { topics },
			audit: { issues: [] }
		}
	};
}
function stub(responses, calls, change = () => undefined) {
	return async (request) => {
		calls.push(request);
		const output = change(request, calls) ?? responses[request.stage];
		return { output, invocationId: 'test-' + calls.length, model: 'synthetic-model' };
	};
}
const allow = async () => {};

function sharedPassageModel() {
	const { packet } = initialFixture();
	const passage = 'My old music teacher made me feel I belonged. I met his daughter Alex again at choir. I might like to stay in touch through choir. I also want to ask her how to help my son prepare for auditions.';
	packet.text = passage;
	packet.turns = [{ id: 'T0', speakerId: 'owner', start: 0, end: passage.length }];
	packet.unresolvedMentions = [];
	const meanings = [
		['M1', 'D1', 'Personal history', 'Importance of the music teacher',
			'The owner’s former music teacher gave them a sense of belonging.', 'OTHER', null],
		['M2', 'D3', 'Friendships', 'Staying in touch through choir',
			'The owner met Alex again at choir and might like to stay in touch through choir.', 'WANT',
			'Staying in touch is a possibility.'],
		['M3', 'D3', 'Family support', 'Asking for audition advice',
			'The owner would like to ask Alex how to help their son prepare for auditions.', 'WANT', null]
	].map(([id, destination, area, topic, text, kind, uncertainty]) => ({
		id, destination, area, topic, text, kind, uncertainty,
		basis: 'DIRECT_ACCOUNT', confidence: 'HIGH',
		evidence: [{ turnId: 'T0', quote: null, role: 'SUPPORTS' }]
	}));
	const compose = { topics: meanings.map((meaning, index) => ({
		...blankTopic(meaning.destination),
		area: meaning.area,
		title: meaning.topic,
		prose: meaning.text,
		timeScope: index === 0 ? 'HISTORICAL' : 'CURRENT',
		primary: [meaning.id]
	})) };
	const invalid = structuredClone(compose);
	invalid.topics[0].contextual = ['M2'];
	invalid.topics[1].contextual = ['M1'];
	// The advice topic already has a valid primary home and must survive intact.
	return {
		input: { packet, prior: [] }, compose,
		responses: { decompose: { meanings, exclusions: [], unresolvedMentions: [] }, compose: invalid, audit: { issues: [] } }
	};
}

test('after a citation repair, repair only cross-group composition links and audit the complete draft', async () => {
	const { input, responses, compose } = sharedPassageModel();
	const calls = [];
	const stageReview = [];
	const trace = { stages: [], audits: [], repairs: [] };
	const result = await assessConversation(input, stub(responses, calls, (request) => {
		const data = JSON.parse(request.userPrompt);
		if (calls.length === 1) {
			const invalid = structuredClone(responses.decompose);
			invalid.meanings[0].evidence[0].quote = 'My old maths teacher';
			return invalid;
		}
		if (calls.length === 3) {
			assert.deepEqual(data.affected.map(({ topicIndex, wrongLinks }) => [topicIndex, wrongLinks]), [
				[0, [{ meaningId: 'M2', destination: 'D3', role: 'contextual' }]],
				[1, [{ meaningId: 'M1', destination: 'D1', role: 'contextual' }]]
			]);
			assert.deepEqual(data.primaryHomes, [
				{ meaningId: 'M1', topicIndex: 0 }, { meaningId: 'M2', topicIndex: 1 }, { meaningId: 'M3', topicIndex: 2 }
			]);
			assert.equal(data.wholeTurns[0].text, input.packet.text);
			return { topics: compose.topics.slice(0, 2).map(({ prose, primary, contextual }, topicIndex) =>
				({ topicIndex, prose, primary, contextual })) };
		}
		if (calls.length === 4) {
			assert.deepEqual(data.draft, compose);
			assert.deepEqual(data.decomposition, responses.decompose);
		}
	}), allow, undefined, trace, stageReview);

	assert.deepEqual(calls.map(({ stage }) => stage), ['decompose', 'compose', 'compose', 'audit']);
	assert.deepEqual(trace.repairs, [
		{ stage: 'decompose', reason: 'INVALID_QUOTE' },
		{ stage: 'compose', reason: 'MEANING_TOPIC' }
	]);
	assert.ok(!JSON.stringify(trace).includes('M1'));
	const [self, relationship, advice] = result.candidate.meanings;
	assert.deepEqual(self.evidence, relationship.evidence);
	assert.deepEqual(advice.evidence, relationship.evidence);
	assert.equal(self.subjectId, 'self');
	assert.equal(relationship.subjectId, 'relationship');
	assert.equal(relationship.expressedUncertainty, 'Staying in touch is a possibility.');
	assert.ok(result.candidate.meanings.every((meaning) => meaning.generation.invocationId === 'test-1'));
	assert.deepEqual(result.candidate.streams.flatMap((stream) => stream.topics.map(({ prose }) => prose)),
		compose.topics.map(({ prose }) => prose));
	assert.match(stageReview.find(({ reason }) => reason === 'MEANING_TOPIC').items[0].text,
		/M2 \(contextual\) belongs to My view of our relationship/);
	assert.equal(stageReview.find(({ reason }) => reason === 'REPAIRED_TOPIC_LINKS').items.length, 3);
	assert.equal(stageReview.at(-1).items[0].title, 'Audit passed');
});

test('a composition link patch cannot touch unrelated topics, discard valid links, or keep foreign IDs', async () => {
	for (const [change, reason] of [
		[(topics) => { topics[1].topicIndex = 2; }, 'INVALID_TOPIC_LINK_REPAIR'],
		[(topics) => { topics[0].primary = []; }, 'INVALID_TOPIC_LINK_REPAIR'],
		[(topics) => { topics[0].contextual = ['M2']; }, 'MEANING_TOPIC']
	]) {
		const { input, responses, compose } = sharedPassageModel();
		const calls = [];
		await assert.rejects(assessConversation(input, stub(responses, calls, () => {
			if (calls.length !== 3) return;
			const topics = compose.topics.slice(0, 2).map(({ prose, primary, contextual }, topicIndex) =>
				({ topicIndex, prose, primary, contextual }));
			change(topics);
			return { topics };
		}), allow), (error) => error.reason === reason && error.diagnostic.stage === 'compose');
		assert.deepEqual(calls.map(({ stage }) => stage), ['decompose', 'compose', 'compose']);
	}
});

test('a composition repair restores unassigned primary meanings to their own destinations', async () => {
	const { input, responses, compose } = sharedPassageModel();
	responses.compose.topics[0].primary = ['M2'];
	responses.compose.topics[0].contextual = [];
	responses.compose.topics[1].primary = ['M1'];
	responses.compose.topics[1].contextual = [];
	const calls = [];
	await assessConversation(input, stub(responses, calls, (request) => {
		const data = JSON.parse(request.userPrompt);
		if (calls.length === 3) {
			assert.deepEqual(data.primaryHomes, [{ meaningId: 'M3', topicIndex: 2 }]);
			assert.ok(data.affected.every(({ wrongLinks }) => wrongLinks[0].role === 'primary'));
			return { topics: compose.topics.slice(0, 2).map(({ prose, primary, contextual }, topicIndex) =>
				({ topicIndex, prose, primary, contextual })) };
		}
		if (calls.length === 4) assert.deepEqual(data.draft, compose);
	}), allow);
	assert.deepEqual(calls.map(({ stage }) => stage), ['decompose', 'compose', 'compose', 'audit']);
});

test('initial assessment preserves the earlier decomposition across every labelled area and three subjects', async () => {
	const { input, responses } = initialModel();
	const calls = [];
	const result = await assessConversation(input, stub(responses, calls), allow);
	const turns = initialTurns.map(([role, text], i) => ({ id: 'T' + i, role, text }));
	const old = validateSemanticDecompositionDraft(
		{
			areas: responses.decompose.meanings.map((m) => ({
				suggestedRealm: m.area,
				suggestedTopic: m.topic,
				relevantTurnIds: m.evidence.filter((e) => e.role === 'SUPPORTS').map((e) => e.turnId)
			}))
		},
		[],
		turns.filter((t) => t.role === 'owner'),
		turns
	);
	assert.equal(old.validForReview, true);
	const topics = result.candidate.streams.flatMap((s) => s.topics);
	assert.deepEqual(new Set(topics.map((t) => t.title)), new Set(old.areas.map((t) => t.topicName)));
	assert.equal(result.candidate.streams.length, 3);
	assert.deepEqual(
		calls.map((c) => c.stage),
		['decompose', 'compose', 'audit']
	);
	assert.deepEqual(
		result.candidate.meanings.find((m) => m.id === 'confirmation').evidence.map((e) => e.role),
		['CONTEXT', 'SUPPORTS']
	);
	assert.equal(result.candidate.meanings.find((m) => m.id === 'confirmation').speakerId, 'owner');
	assert.equal(result.candidate.meanings.find((m) => m.id === 'M4').basis, 'REPORTED_ASSERTION');
	assert.equal(result.candidate.meanings.find((m) => m.id === 'M4').asserter.kind, 'UNRESOLVED');
	assert.deepEqual(topics.find((t) => t.title === 'Social needs').contextualMeaningIds, ['M0']);
	assert.equal(result.unresolvedMentions[0].text, 'Morgan');
	assert.ok(!calls[0].userPrompt.includes('fixture-vault'));
	assert.ok(!JSON.stringify(result.candidate).includes('resents'));
	assert.equal(result.provenance.invocations.length, 3);
});

test('Dorian suggestions and non-committal replies cannot provide owner evidence', async () => {
	for (const [turnId, quote, error] of [
		['T10', initialTurns[10][1], /NON_OWNER_EVIDENCE/],
		['T10', 'Unmatched excerpt from an agent turn', /NON_OWNER_EVIDENCE/],
		['T11', 'Maybe', /AMBIGUOUS_ASSENT/],
		['T11', 'Unmatched excerpt from a non-committal answer', /AMBIGUOUS_ASSENT/],
		['T11', initialTurns[11][1], /AMBIGUOUS_ASSENT/],
		['T13', 'Yes', /AMBIGUOUS_ASSENT/]
	]) {
		const { input, responses } = initialModel();
		responses.decompose.meanings[0].evidence = [{ turnId, quote, role: 'SUPPORTS' }];
		const calls = [];
		await assert.rejects(assessConversation(input, stub(responses, calls), allow), error);
		assert.equal(calls.length, 2);
	}
});

test('an invalid quote and unsupported wording get separate bounded repairs', async () => {
	const { input, responses } = initialModel();
	const calls = [];
	const stageReview = [];
	const original = responses.compose.topics[0].prose;
	const result = await assessConversation(input, stub(responses, calls, (request) => {
		const data = JSON.parse(request.userPrompt);
		if (calls.length === 1) {
			const invalid = structuredClone(responses.decompose);
			invalid.meanings[0].evidence[0].quote = 'Invented quote';
			return invalid;
		}
		if (calls.length === 2) {
			const draft = structuredClone(responses.compose);
			draft.topics[0].prose = 'Unsupported wording.';
			return draft;
		}
		if (calls.length === 3) return { issues: ['UNSUPPORTED_PROSE'], unsupportedTopicIndexes: [0] };
		if (calls.length === 4) {
			assert.deepEqual(data.topics.map((topic) => topic.topicIndex), [0]);
			return { paragraphs: [{ topicIndex: 0, prose: original }] };
		}
		if (calls.length === 5) assert.deepEqual(data.draft, responses.compose);
	}), allow, undefined, undefined, stageReview);
	assert.deepEqual(calls.map(({ stage }) => stage), ['decompose', 'compose', 'audit', 'compose', 'audit']);
	assert.deepEqual(result.provenance.repairs, [
		{ stage: 'decompose', reason: 'INVALID_QUOTE' }, { stage: 'audit', reason: 'UNSUPPORTED_PROSE' }
	]);
	assert.equal(result.candidate.meanings[0].generation.invocationId, 'test-1');
	assert.deepEqual(stageReview.filter(({ reason }) => !reason).map(({ stage, attempt }) => [stage, attempt]), [
		['decompose', 1], ['compose', 1], ['audit', 1], ['compose', 2], ['audit', 2]
	]);
	assert.ok(stageReview.find(({ stage, attempt }) => stage === 'audit' && attempt === 1)
		.items.some(({ text }) => text.includes('Unsupported wording.')));
	assert.deepEqual(result.provenance.stageReview, stageReview);
});

test('a repeated semantic audit failure still blocks review', async () => {
	const { input, responses } = initialModel();
	const failed = [];
	await assert.rejects(
		assessConversation(
			input,
			stub(responses, failed, (request) =>
				request.stage === 'audit' ? { issues: ['MISATTRIBUTION'] } : undefined
			),
			allow
		),
		/MISATTRIBUTION/
	);
	assert.equal(failed.length, 6);
});

test('whole-turn citation repair leaves semantic audit and its retry in charge of attribution', async () => {
	const { input, responses } = sharedPassageModel();
	responses.compose.topics.forEach((topic) => { topic.contextual = []; });
	// The transcript says who the teacher was. The new claim changes who taught whom.
	const meaning = responses.decompose.meanings[0];
	meaning.text = 'The owner was Alex’s music teacher and gave her a sense of belonging.';
	meaning.evidence[0].quote = 'My old maths teacher made me feel I belonged.';
	responses.compose.topics[0].prose = meaning.text;
	const calls = [];
	const trace = { stages: [], audits: [], repairs: [] };
	await assert.rejects(assessConversation(input, stub(responses, calls, (request) => {
		const data = JSON.parse(request.userPrompt);
		if (calls.length === 4) {
			assert.deepEqual(data.attributionRepair, [{
				claim: meaning.text, turnIds: ['T0'], issue: 'INSUFFICIENT_OWNER_SUPPORT'
			}]);
			assert.deepEqual(data.repair, { stage: 'audit', reason: 'MISATTRIBUTION' });
		}
		if (request.stage === 'audit') {
			assert.equal(data.decomposition.meanings[0].evidence[0].quote, null);
			return {
				issues: ['MISATTRIBUTION', 'UNSUPPORTED_PROSE', 'OMITTED_MEANING'],
				attributionFindings: [{ target: 'MEANING', meaningId: meaning.id, issue: 'INSUFFICIENT_OWNER_SUPPORT' }]
			};
		}
	}), allow, undefined, trace), { reason: 'MISATTRIBUTION', diagnostic: { stage: 'audit', attempt: 2 } });
	assert.deepEqual(calls.map(({ stage }) => stage), ['decompose', 'compose', 'audit', 'decompose', 'compose', 'audit']);
	assert.deepEqual(trace.repairs, [
		{ stage: 'decompose', reason: 'INVALID_QUOTE' },
		{ stage: 'audit', reason: 'MISATTRIBUTION' },
		{ stage: 'decompose', reason: 'INVALID_QUOTE' }
	]);
});

test('unsupported prose after a wording repair still blocks review with private findings', async () => {
	const { input, responses } = initialModel();
	const calls = [];
	await assert.rejects(assessConversation(input, stub(responses, calls, (request) => {
		if (request.stage === 'audit') return { issues: ['UNSUPPORTED_PROSE'], unsupportedTopicIndexes: [0] };
		if (request.stage === 'compose' && calls.length === 4)
			return { paragraphs: [{ topicIndex: 0, prose: 'Still unsupported.' }] };
	}), allow), (error) => {
		assert.equal(error.reason, 'UNSUPPORTED_PROSE');
		assert.equal(error.reviewFindings[0].claim, 'Still unsupported.');
		assert.equal(error.reviewFindings[0].evidence[0].speaker, 'OWNER');
		return true;
	});
	assert.deepEqual(calls.map(({ stage }) => stage), ['decompose', 'compose', 'audit', 'compose', 'audit']);
});

test('subject audit identifies the misrouted meaning for a fresh extraction and rechecks the repair', async () => {
	const { input, responses } = initialModel();
	const index = 5;
	const correct = responses.decompose.meanings[index];
	const badDestination = 'D1';
	const calls = [];
	const model = stub(responses, calls, (request) => {
		const prompt = JSON.parse(request.userPrompt);
		if (calls.length === 1) {
			const draft = structuredClone(responses.decompose);
			draft.meanings[index].destination = badDestination;
			return draft;
		}
		if (calls.length === 2) {
			const draft = structuredClone(responses.compose);
			draft.topics[index].destination = badDestination;
			return draft;
		}
		if (calls.length === 3) return {
			issues: ['BAD_SUBJECT'],
			subjectFindings: [
				{ meaningId: correct.id, suggestedDestination: correct.destination },
				{ meaningId: 'unknown', suggestedDestination: correct.destination },
				{ meaningId: correct.id, suggestedDestination: 'unknown' }
			]
		};
		if (calls.length === 4) {
			assert.deepEqual(prompt.subjectRepair, [{
				meaning: correct.text, turnIds: correct.evidence.map(({ turnId }) => turnId),
				from: badDestination, suggestedDestination: correct.destination
			}]);
			assert.match(request.systemPrompt, /suggestions refer to the previous draft and are advisory/);
		}
		if (calls.length === 5) {
			assert.deepEqual(prompt.destinations.map(({ role }) => role), ['SELF', 'PERSON', 'RELATIONSHIP']);
		}
	});
	const result = await assessConversation(input, model, allow);
	assert.equal(calls.length, 6);
	assert.deepEqual(result.provenance.repairs, [{ stage: 'audit', reason: 'BAD_SUBJECT' }]);
	assert.equal(result.candidate.meanings[index].subjectId, input.packet.subjects[2].id);

	const repeated = [];
	await assert.rejects(
		assessConversation(input, stub(responses, repeated, (request) =>
			request.stage === 'audit' ? { issues: ['BAD_SUBJECT'] } : undefined), allow),
		{ reason: 'BAD_SUBJECT', diagnostic: { stage: 'audit', attempt: 2 } }
	);
	assert.equal(repeated.length, 6);
});

test('attribution repair keeps a wish about the pair under the relationship and restores who expressed it', async () => {
	const { input, responses } = initialModel();
	const index = 5;
	const wish = responses.decompose.meanings[index];
	const unsupported = 'Both people want to spend more time together.';
	const calls = [];
	const result = await assessConversation(input, stub(responses, calls, (request) => {
		if (calls.length === 2) {
			const draft = structuredClone(responses.compose);
			draft.topics[index].prose = unsupported;
			return draft;
		}
		if (calls.length === 3) return {
			issues: ['MISATTRIBUTION'],
			attributionFindings: [
				{ target: 'TOPIC', topicIndex: index, issue: 'ONE_SIDED_AS_SHARED' },
				{ target: 'MEANING', meaningId: 'missing', issue: 'AGENT_AS_OWNER' }
			]
		};
		if (calls.length === 4) {
			assert.deepEqual(JSON.parse(request.userPrompt).attributionRepair, [{
				issue: 'ONE_SIDED_AS_SHARED', claim: unsupported, turnIds: [wish.evidence[0].turnId]
			}]);
		}
	}), allow);
	assert.equal(calls.length, 6);
	const relationship = result.candidate.streams.find((stream) => stream.subjectId === input.packet.subjects[2].id);
	assert.equal(relationship.topics.find((topic) => topic.meaningIds.includes(wish.id)).prose, wish.text);
	assert.equal(result.candidate.meanings[index].speakerId, 'owner');
	assert.deepEqual(result.provenance.repairs, [{ stage: 'audit', reason: 'MISATTRIBUTION' }]);
});

test('strict model shapes, omitted evidence, wrong subjects and cancellation fail closed', async () => {
	for (const [change, error] of [
		[
			(r) => {
				r.decompose = 'not JSON';
			},
			/INVALID_MODEL_OUTPUT/
		],
		[
			(r) => {
				r.decompose.exclusions.pop();
			},
			/OMITTED_OWNER_TURN/
		],
		[
			(r) => {
				r.decompose.meanings[0].evidence[0].turnId = 'unknown';
			},
			/UNKNOWN_TURN/
		],
		[
			(r) => {
				r.compose.topics[0].destination = 'unknown';
			},
			/TOPIC_TARGET/
		],
		[
			(r) => {
				r.compose.topics.pop();
			},
			/OMITTED_MEANING_OR_TOPIC/
		]
	]) {
		const { input, responses } = initialModel();
		change(responses);
		await assert.rejects(assessConversation(input, stub(responses, []), allow), error);
	}
	const { input, responses } = initialModel();
	const controller = new AbortController();
	const calls = [];
	await assert.rejects(
		assessConversation(
			input,
			stub(responses, calls, () => controller.abort()),
			allow,
			controller.signal
		),
		(e) => e.name === 'AbortError'
	);
	assert.equal(calls.length, 1);
});

function followupModel() {
	const { packet } = initialFixture();
	packet.source = {
		...packet.source,
		versionId: 'source-v2',
		occurredAt: '2026-11-11T03:00:00.000Z'
	};
	packet.unresolvedMentions = [];
	const prior = secondConversation
		.filter((c) => c.effect !== 'NEW')
		.map((c, i) => ({
			subjectId: 'self',
			perspectiveId: 'view-self',
			topicId: 'topic-' + i,
			versionId: 'version-' + i,
			area: 'Life',
			title: c.topic,
			prose: 'Previous ' + c.topic,
			timeScope: 'HISTORICAL',
			sourceAt: '2026-11-10T03:00:00.000Z',
			meanings: [
				{ versionId: 'prior-meaning-' + i, text: 'Previous detail ' + i },
				{ versionId: 'retained-meaning-' + i, text: 'Unaffected detail ' + i }
			]
		}));
	packet.baselines[0] = {
		...packet.baselines[0],
		revisionId: 'v1',
		topics: prior.map((p) => ({
			topicId: p.topicId,
			versionId: p.versionId,
			meaningVersionIds: p.meanings.map((m) => m.versionId)
		}))
	};
	packet.text = '';
	packet.turns = [];
	const meanings = [];
	const topics = secondConversation.map((c, i) => {
		const row = blankTopic('D1', c.effect === 'NEW' ? null : 'P' + (i + 1), c.effect);
		if (c.effect === 'UNCHANGED') return row;
		const start = packet.text.length;
		packet.text += c.text;
		packet.turns.push({ id: 'F' + i, speakerId: 'owner', start, end: packet.text.length });
		packet.text += '\n';
		meanings.push({
			id: 'M' + i,
			destination: 'D1',
			area: 'Life',
			topic: c.topic,
			text: c.text,
			kind: 'PREFERENCE',
			basis: 'DIRECT_ACCOUNT',
			uncertainty: null,
			confidence: 'MEDIUM',
			evidence: [{ turnId: 'F' + i, quote: c.text, role: 'SUPPORTS' }]
		});
		return {
			...row,
			area: 'Life',
			title: c.topic,
			prose: c.text,
			timeScope: 'MIXED',
			primary: ['M' + i],
			retire:
				c.effect === 'SUPERSEDED'
					? [{ meaning: 'P' + (i + 1) + 'M1', reason: 'Explicit replacement' }]
					: []
		};
	});
	return {
		input: { packet, prior },
		responses: {
			decompose: { meanings, exclusions: [], unresolvedMentions: [] },
			compose: { topics },
			audit: { issues: [] }
		}
	};
}

test('longitudinal assessment preserves each earlier effect, exact version and unaffected meaning', async () => {
	const { input, responses } = followupModel();
	const result = await assessConversation(input, stub(responses, []), allow);
	const topics = result.candidate.streams[0].topics;
	assert.deepEqual(
		topics.map((t) => t.effect),
		secondConversation.map((c) => c.effect)
	);
	assert.equal(topics[6].previousVersionId, input.prior[6].versionId);
	assert.equal(topics[6].prose, input.prior[6].prose);
	assert.deepEqual(topics[4].retainedMeaningVersionIds, ['retained-meaning-4']);
	assert.deepEqual(topics[4].retiredMeanings, [
		{ versionId: 'prior-meaning-4', reason: 'Explicit replacement' }
	]);
	assert.equal(topics[5].retainedMeaningVersionIds.length, 2);
	assert.equal(topics[7].previousVersionId, null);
	const allTurns = input.packet.turns.map((t) => ({ id: t.id }));
	const old = validateLongitudinalAnalysisDraft(
		{
			topicEffects: responses.compose.topics
				.filter((t) => t.prior)
				.map((t, i) => ({
					targetKey: t.prior,
					effect: t.effect,
					relevantTurnIds: t.effect === 'UNCHANGED' ? [] : ['F' + i]
				}))
		},
		input.prior.map((t, i) => ({ targetKey: 'P' + (i + 1), topicName: t.title })),
		allTurns,
		allTurns
	);
	assert.equal(old.validForReview, true);
	assert.deepEqual(
		topics.slice(0, 7).map((t) => t.effect),
		old.topicEffects.map((t) => t.effect)
	);
	input.packet.source.occurredAt = '2026-11-09T03:00:00.000Z';
	await assert.rejects(
		assessConversation(input, stub(responses, []), allow),
		/SUPERSESSION_CHRONOLOGY/
	);
});

test('no durable meaning yields an explicit no-change candidate after audit', async () => {
	const { input } = initialModel();
	input.packet.text = 'Thanks, Dorian.';
	input.packet.unresolvedMentions = [];
	input.packet.turns = [{ id: 'F0', speakerId: 'owner', start: 0, end: input.packet.text.length }];
	const calls = [];
	const result = await assessConversation(
		input,
		stub(
			{
				decompose: {
					meanings: [],
					exclusions: [{ turnId: 'F0', reason: 'CONVERSATIONAL' }],
					unresolvedMentions: []
				},
				compose: { topics: [] },
				audit: { issues: [] }
			},
			calls
		),
		allow
	);
	assert.deepEqual(result.candidate.streams, []);
	assert.deepEqual(result.candidate.meanings, []);
	assert.equal(calls.length, 3);
});

test('rejects copied topic prose and provider timeouts with bounded calls', async () => {
	const { input, responses } = initialModel();
	responses.compose.topics[1].prose = responses.compose.topics[0].prose;
	await assert.rejects(
		assessConversation(input, stub(responses, []), allow),
		/DUPLICATE_TOPIC_PROSE/
	);
	let calls = 0;
	await assert.rejects(
		assessConversation(
			input,
			async () => {
				calls++;
				throw new DOMException('provider timeout', 'TimeoutError');
			},
			allow
		),
		/MODEL_TIMEOUT/
	);
	assert.equal(calls, 1);
});

test('a direct answer retains its question and repeated excerpts require an exact offset', async () => {
	const { input, responses } = initialModel();
	const question = 'Would you prefer mornings?';
	const answer = 'Yes.';
	input.packet.text = question + '\n' + answer;
	input.packet.turns = [
		{ id: 'Q', speakerId: 'agent', start: 0, end: question.length },
		{ id: 'A', speakerId: 'owner', start: question.length + 1, end: input.packet.text.length }
	];
	input.packet.unresolvedMentions = [];
	const meaning = {
		...responses.decompose.meanings[0],
		text: 'Prefers mornings.',
		evidence: [
			{ turnId: 'Q', quote: question, role: 'CONTEXT' },
			{ turnId: 'A', quote: answer, role: 'SUPPORTS' }
		]
	};
	responses.decompose = { meanings: [meaning], exclusions: [], unresolvedMentions: [] };
	responses.compose.topics = [
		{
			...responses.compose.topics[0],
			prose: meaning.text
		}
	];
	meaning.evidence[0].quote = null;
	meaning.evidence[1].quote = null;
	const first = await assessConversation(input, stub(responses, []), allow);
	assert.deepEqual(
		first.candidate.meanings[0].evidence.map((e) => e.role),
		['CONTEXT', 'SUPPORTS']
	);
	meaning.evidence.shift();
	await assert.rejects(assessConversation(input, stub(responses, []), allow), /AMBIGUOUS_ASSENT/);

	const phrase = 'I prefer mornings 😀.';
	input.packet.text = question + '\n' + phrase + '\n' + phrase;
	input.packet.turns[1].end = input.packet.text.length;
	meaning.evidence[0] = { turnId: 'A', quote: phrase, role: 'SUPPORTS' };
	await assert.rejects(assessConversation(input, stub(responses, []), allow), /INVALID_QUOTE/);
	meaning.evidence[0].offset = 1;
	await assert.rejects(assessConversation(input, stub(responses, []), allow), /INVALID_QUOTE/);
	meaning.evidence[0].offset = phrase.length + 1;
	const result = await assessConversation(input, stub(responses, []), allow);
	const anchor = result.candidate.meanings[0].evidence[0];
	assert.equal(anchor.start, question.length + phrase.length + 2);
	assert.equal(input.packet.text.slice(anchor.start, anchor.end), phrase);
});


test('invalid excerpts can be repaired by citing whole turns and unique exact excerpts resolve their own offsets', async () => {
	const { input, responses } = initialModel();
	const citation = responses.decompose.meanings[0].evidence[0];
	const exactQuote = citation.quote;
	const turn = input.packet.turns.find((item) => item.id === citation.turnId);
	const original = input.packet.text.slice(turn.start, turn.end);
	const expected = structuredClone(responses.decompose);
	expected.meanings[0].evidence[0].quote = null;
	const calls = [];
	const stageReview = [];
	const result = await assessConversation(input, stub(responses, calls, (request) => {
		if (request.stage === 'decompose') {
			const draft = structuredClone(responses.decompose);
			Object.assign(draft.meanings[0].evidence[0], {
				quote: 'A paraphrase absent from the transcript', offset: 4
			});
			return draft;
		}
		if (request.stage === 'compose' || request.stage === 'audit') {
			const prompt = JSON.parse(request.userPrompt);
			const turns = request.stage === 'compose' ? prompt.wholeTurns : prompt.source.turns;
			assert.equal(turns.find((item) => item.id === turn.id).text, original);
			assert.deepEqual(prompt.decomposition, expected);
		}
	}), allow, undefined, undefined, stageReview);
	assert.deepEqual(calls.map(({ stage }) => stage), ['decompose', 'compose', 'audit']);
	assert.deepEqual(result.provenance.repairs, [{ stage: 'decompose', reason: 'INVALID_QUOTE' }]);
	assert.equal(result.candidate.meanings[0].generation.invocationId, 'test-1');
	assert.deepEqual(stageReview.find(({ reason }) => reason === 'REPAIRED_CITATIONS').items, [{
		title: 'M0 · ' + turn.id, text: 'Replaced an unmatched excerpt with the original whole turn (SUPPORTS).'
	}]);
	const [anchor] = result.candidate.meanings[0].evidence;
	assert.equal(anchor.quote, original);
	assert.equal(anchor.start, turn.start);
	assert.equal(anchor.end, turn.end);

	citation.quote = exactQuote;
	citation.offset = original.length + 1;
	const unique = await assessConversation(input, stub(responses, [], (request) => {
		if (request.stage === 'audit') {
			const prompt = JSON.parse(request.userPrompt);
			assert.equal(prompt.decomposition.meanings[0].evidence[0].offset, original.indexOf(exactQuote));
		}
	}), allow);
	const [resolved] = unique.candidate.meanings[0].evidence;
	assert.equal(resolved.quote, exactQuote);
	assert.equal(resolved.start, turn.start + original.indexOf(exactQuote));
});
