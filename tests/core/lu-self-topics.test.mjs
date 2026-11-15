// Invented conversations test the adapter's boundaries, not live model quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	assessSelfTopics,
	selfTopicPromptVersion
} from '../../src/lib/server/livingUnderstanding/selfTopicAssessment.ts';
import { initialFixture } from './fixtures/lu/conversations.mjs';

const allow = async () => {};
function fixture(
	words = [
		['agent', 'What did the encounter mean to you?'],
		[
			'owner',
			'Sam was my mentor and felt like a father to me. Meeting his family again felt meaningful. I hope to stay in touch.'
		],
		[
			'owner',
			'My daughter is applying to music colleges. I want to understand her options so I can support her.'
		],
		['agent', 'Maybe you want to become a musician yourself?'],
		['owner', 'Maybe, but I really do not know.']
	]
) {
	const { packet } = initialFixture();
	packet.text = '';
	packet.unresolvedMentions = [];
	packet.turns = words.map(([speakerId, text], i) => {
		const start = packet.text.length;
		packet.text += text + '\n';
		return { id: 'T' + i, speakerId, start, end: packet.text.length - 1 };
	});
	return { packet, prior: [] };
}
const area = (title, turns, prior = '') => ({
	existingTopicId: prior,
	suggestedRealm: 'Personal life',
	suggestedTopic: title,
	impact: 'SIGNIFICANT',
	reason: 'The personal meaning and hopes belong together, with supporting details.',
	relevantTurnIds: turns
});
const meaning = (text, turn) => ({
	text,
	kind: 'OTHER',
	basis: 'DIRECT_ACCOUNT',
	uncertainty: null,
	confidence: 'HIGH',
	evidence: [{ turnId: turn, quote: null, role: 'SUPPORTS' }]
});
function modelFor(input, { change = () => {}, noChange = false } = {}) {
	const calls = [];
	const model = async (request) => {
		const data = JSON.parse(request.userPrompt);
		calls.push({ ...request, data });
		let output;
		if (request.stage === 'decompose')
			output = {
				areas: noChange
					? []
					: [
							area('Mentorship and reconnection', ['T1'], input.prior[0] ? 'P1' : ''),
							area('Supporting my daughter', ['T2'])
						],
				exclusions: noChange
					? input.packet.turns
							.filter((t) => t.speakerId === 'owner')
							.map((t) => ({ turnId: t.id, reason: 'CONVERSATIONAL' }))
					: [{ turnId: 'T4', reason: 'UNCLEAR' }],
				unresolvedMentions: []
			};
		else if (request.stage === 'compose') {
			const turn = data.turns.find((t) => t.role === 'OWNER');
			output = {
				prose: (data.prior ? data.prior.prose + ' ' : '') + turn.text,
				timeScope: 'MIXED',
				effect: data.prior ? 'EXPANDED' : 'NEW',
				retire: [],
				meanings: [meaning(turn.text, turn.id)]
			};
		} else output = { issues: [], findings: [] };
		change({ request, data, output, calls });
		return { output, invocationId: 'synthetic-' + calls.length, model: 'synthetic' };
	};
	return { model, calls };
}

test('topic discovery precedes writing, preserves coherent scope and records exact evidence', async () => {
	const input = fixture();
	const { model, calls } = modelFor(input);
	const panels = [];
	const result = await assessSelfTopics(input, model, allow, undefined, undefined, panels);
	assert.equal(calls.length, 4);
	assert.equal(calls[0].stage, 'decompose');
	assert.match(calls[0].systemPrompt, /Do not atomise every nuance/);
	assert.equal(calls[0].data.source.turns.length, 5);
	assert.equal(
		calls[1].data.turns.some((t) => t.id === 'T2'),
		false
	);
	assert.equal(calls[1].data.turns[0].role, 'AGENT');
	assert.equal(calls[1].data.otherAreas[0].title, 'Supporting my daughter');
	assert.equal(result.candidate.streams.length, 1);
	assert.equal(result.candidate.streams[0].subjectId, 'self');
	assert.equal(result.candidate.streams[0].topics.length, 2);
	assert.match(result.candidate.streams[0].topics[0].prose, /father.*meaningful.*stay in touch/);
	for (const m of result.candidate.meanings) {
		assert.equal(m.generation.promptVersion, selfTopicPromptVersion);
		assert.equal(m.review, 'UNREVIEWED');
		for (const e of m.evidence) assert.equal(input.packet.text.slice(e.start, e.end), e.quote);
	}
	assert.deepEqual(
		panels.map((p) => p.stage),
		['decompose', 'compose', 'compose', 'audit']
	);
});

test('later conversations preserve exact prior versions and untouched other perspectives', async () => {
	const input = fixture();
	const prior = (id, subject, title) => ({
		subjectId: subject,
		perspectiveId: 'view-' + subject,
		topicId: id,
		versionId: id + '-v1',
		area: 'Personal life',
		title,
		prose: 'Earlier supported understanding.',
		timeScope: 'CURRENT',
		sourceAt: '2026-01-01T00:00:00Z',
		meanings: [{ versionId: id + '-m1', text: 'Earlier supported understanding.' }]
	});
	input.prior = [
		prior('mentor', 'self', 'Mentorship and reconnection'),
		prior('person', 'alex', 'My view of Alex'),
		prior('relationship', 'relationship', 'Our history')
	];
	input.packet.baselines = input.packet.baselines.map((b) => ({
		...b,
		revisionId: 'revision-' + b.subjectId,
		topics: input.prior
			.filter((p) => p.subjectId === b.subjectId)
			.map((p) => ({
				topicId: p.topicId,
				versionId: p.versionId,
				meaningVersionIds: p.meanings.map((m) => m.versionId)
			}))
	}));
	const { model, calls } = modelFor(input);
	const result = await assessSelfTopics(input, model, allow);
	const self = result.candidate.streams.find((s) => s.subjectId === 'self');
	assert.equal(self.topics[0].effect, 'EXPANDED');
	assert.equal(self.topics[0].previousVersionId, 'mentor-v1');
	assert.deepEqual(self.topics[0].retainedMeaningVersionIds, ['mentor-m1']);
	for (const stream of result.candidate.streams.filter((s) => s.subjectId !== 'self')) {
		assert.equal(stream.topics[0].effect, 'UNCHANGED');
		assert.equal(stream.topics[0].prose, 'Earlier supported understanding.');
	}
	assert.equal(calls[0].data.prior.length, 1);
	assert.equal(
		calls.at(-1).data.draft.every((t) => t.destination === 'D1'),
		true
	);
});

test('a source passage can support several coherent areas without exclusive ownership', async () => {
	const input = fixture();
	const { model } = modelFor(input, {
		change: ({ request, output }) => {
			if (request.stage === 'decompose') output.areas[1].relevantTurnIds = ['T1', 'T2'];
			if (request.stage === 'compose' && output.meanings[0].text.includes('Sam')) {
				// The topic writer can use both supplied owner turns where its area requires them.
				if (JSON.parse(request.userPrompt).area.title === 'Supporting my daughter') {
					output.meanings.push(meaning('I want to support my daughter.', 'T2'));
					output.prose =
						'I want to support my daughter, while reflecting on the support I received.';
				}
			}
		}
	});
	const result = await assessSelfTopics(input, model, allow);
	assert.equal(
		result.candidate.meanings.filter((m) => m.evidence.some((e) => e.turnId === 'T1')).length,
		2
	);
});

test('agent support, evidence outside the area, omissions and structural failures are held', async () => {
	for (const [reason, change] of [
		[
			'DECOMPOSITION_POLICY',
			({ request, output }) => {
				if (request.stage === 'decompose') output.areas[0].relevantTurnIds = ['T0'];
			}
		],
		[
			'OUT_OF_TOPIC_EVIDENCE',
			({ request, output }) => {
				if (request.stage === 'compose') output.meanings[0].evidence[0].turnId = 'T3';
			}
		],
		[
			'OMITTED_OWNER_TURN',
			({ request, output }) => {
				if (request.stage === 'decompose') output.exclusions = [];
			}
		],
		[
			'MISATTRIBUTION',
			({ request, output }) => {
				if (request.stage === 'audit') {
					output.issues = ['MISATTRIBUTION'];
					output.findings = ['Mentorship: the agent suggestion was not endorsed.'];
				}
			}
		]
	]) {
		const input = fixture();
		const { model } = modelFor(input, { change });
		const panels = [];
		await assert.rejects(
			assessSelfTopics(input, model, allow, undefined, undefined, panels),
			(e) => e.reason === reason
		);
		if (reason === 'MISATTRIBUTION') assert.match(panels.at(-1).items[0].text, /not endorsed/);
	}
});

test('empty discovery is audited and can produce an explicit no-change candidate', async () => {
	const input = fixture([['owner', 'Thanks.']]);
	const { model, calls } = modelFor(input, { noChange: true });
	const result = await assessSelfTopics(input, model, allow);
	assert.equal(result.candidate.meanings.length, 0);
	assert.deepEqual(
		calls.map((c) => c.stage),
		['decompose', 'audit']
	);
});

test('cancellation and revoked authority stop processing without a candidate', async () => {
	const input = fixture();
	const { model, calls } = modelFor(input);
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(assessSelfTopics(input, model, allow, controller.signal));
	assert.equal(calls.length, 0);
	let n = 0;
	await assert.rejects(
		assessSelfTopics(input, model, async () => {
			if (++n === 2) throw new Error('revoked');
		}),
		/revoked/
	);
	assert.equal(calls.length, 1);
});
