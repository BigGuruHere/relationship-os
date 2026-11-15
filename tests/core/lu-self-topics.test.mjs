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

test('only the topic with an invalid citation is retried before structural review', async () => {
	const input = fixture();
	const { model, calls } = modelFor(input, {
		change({ request, data, output }) {
			if (
				request.stage === 'compose' &&
				data.area.title === 'Supporting my daughter' &&
				!data.correction
			) {
				// T1 is real evidence for another topic, but unavailable to this writer.
				output.meanings[0].evidence[0].turnId = 'T1';
			}
		}
	});
	const trace = { stages: [], audits: [], repairs: [] };
	const result = await assessSelfTopics(input, model, allow, undefined, trace);
	const writes = calls.filter((call) => call.stage === 'compose');
	assert.equal(writes.length, 3);
	assert.equal(writes.at(-1).data.area.title, 'Supporting my daughter');
	assert.deepEqual(writes.at(-1).data.allowedCitations.owner, ['T2']);
	assert.match(writes.at(-1).data.correction, /first draft cited/);
	assert.equal(calls.at(-1).stage, 'audit');
	assert.equal(result.candidate.streams[0].topics.length, 2);
	assert.equal(
		result.candidate.meanings.find((meaning) => meaning.id === 'A2M1').evidence[0].turnId,
		'T2'
	);
	assert.ok(
		trace.stages.some(
			(stage) =>
				stage.stage === 'compose' &&
				stage.attempt === 1 &&
				stage.outcome === 'OUT_OF_TOPIC_EVIDENCE'
		)
	);
	assert.ok(
		trace.stages.some(
			(stage) => stage.stage === 'compose' && stage.attempt === 2 && stage.outcome === 'COMPLETED'
		)
	);
});

test('a second invalid citation holds the run and preserves valid sibling drafts in the preview', async () => {
	const input = fixture();
	const { model, calls } = modelFor(input, {
		change({ request, data, output }) {
			if (request.stage === 'compose' && data.area.title === 'Mentorship and reconnection') {
				// The adjacent agent question is available as context, not as owner support.
				output.meanings[0].evidence[0].turnId = 'T0';
			}
		}
	});
	const panels = [];
	await assert.rejects(
		assessSelfTopics(input, model, allow, undefined, undefined, panels),
		(error) => {
			assert.equal(error.reason, 'OUT_OF_TOPIC_EVIDENCE');
			assert.deepEqual(error.diagnostic, { stage: 'compose', attempt: 2 });
			return true;
		}
	);
	assert.equal(calls.filter((call) => call.stage === 'compose').length, 3);
	assert.equal(
		calls.some((call) => call.stage === 'audit'),
		false
	);
	assert.ok(
		panels.some((panel) =>
			panel.items.some((item) => item.title === 'Topic understanding: Supporting my daughter')
		)
	);
	assert.ok(
		panels.some((panel) =>
			panel.items.some((item) => item.title === 'Topic held: Mentorship and reconnection')
		)
	);
});

test('structural review repairs only named topics and re-audits the full draft', async () => {
	const input = fixture();
	let auditCount = 0;
	const issues = ['DUPLICATE_TOPIC', 'UNSUPPORTED_PROSE', 'OMITTED_MEANING'];
	const { model, calls } = modelFor(input, {
		change({ request, data, output }) {
			if (request.stage === 'decompose') output.areas.push(area('Family history', ['T1']));
			if (request.stage === 'compose' && data.area.title === 'Family history') {
				output.prose = 'Meeting his family again felt meaningful.';
				output.meanings = [meaning(output.prose, 'T1')];
			}
			if (data.auditRepair) {
				assert.equal(data.area.title, 'Supporting my daughter');
				assert.deepEqual(data.allowedCitations.owner, ['T2']);
				assert.equal(data.auditRepair.findings.length, 3);
				assert.deepEqual(
					data.auditRepair.otherDrafts.map((topic) => topic.topicRef),
					['A1', 'A3']
				);
				output.title = 'Musical theatre plans';
				output.prose =
					'My daughter is applying to music colleges and I want to understand her options.';
				output.meanings = [meaning(output.prose, 'T2')];
			}
			if (request.stage !== 'audit') return;
			assert.deepEqual(
				data.draft.map((topic) => topic.topicRef),
				['A1', 'A2', 'A3']
			);
			if (++auditCount === 1) {
				output.issues = issues;
				output.findings = [
					'One topic repeats a wish, implies a motive and omits relevant context.'
				];
				output.topicRepairs = issues.map((issue) => ({
					issue,
					editTopics: ['A2'],
					instruction: 'Recheck the selected draft against what the owner said.'
				}));
			} else {
				assert.equal(data.draft[0].title, 'Mentorship and reconnection');
				assert.equal(data.draft[1].title, 'Musical theatre plans');
				assert.equal(data.draft[2].prose, 'Meeting his family again felt meaningful.');
				assert.ok(
					data.meanings.some(
						(meaning) => meaning.id === 'A2M1' && meaning.evidence[0].turnId === 'T2'
					)
				);
			}
		}
	});
	const trace = { stages: [], audits: [], repairs: [] };
	const panels = [];
	const result = await assessSelfTopics(input, model, allow, undefined, trace, panels);
	assert.equal(calls.filter((call) => call.data.auditRepair).length, 1);
	assert.deepEqual(
		trace.audits.map((audit) => [audit.attempt, audit.issues]),
		[
			[1, issues],
			[2, []]
		]
	);
	assert.deepEqual(result.provenance.repairs, [{ stage: 'audit', reason: 'DUPLICATE_TOPIC' }]);
	assert.equal(result.candidate.streams[0].topics[1].title, 'Musical theatre plans');
	assert.ok(
		panels.some((panel) =>
			panel.items.some((item) => item.title === 'Revise topic: Supporting my daughter')
		)
	);
});

test('unknown, incomplete, and out-of-scope audit plans leave the draft held', async () => {
	for (const { issues, target } of [
		{ issues: ['UNSUPPORTED_PROSE'], target: 'A3' },
		{ issues: ['UNSUPPORTED_PROSE', 'MISATTRIBUTION'], target: 'A2' },
		{ issues: ['UNSUPPORTED_PROSE', 'OMITTED_MEANING'], target: 'A2' }
	]) {
		const input = fixture();
		const { model, calls } = modelFor(input, {
			change({ request, output }) {
				if (request.stage !== 'audit') return;
				output.issues = issues;
				output.topicRepairs = [
					{ issue: 'UNSUPPORTED_PROSE', editTopics: [target], instruction: 'Clarify the wording.' }
				];
			}
		});
		await assert.rejects(
			assessSelfTopics(input, model, allow),
			(error) => error.reason === 'UNSUPPORTED_PROSE' && error.diagnostic.attempt === 1
		);
		assert.equal(
			calls.some((call) => call.data.auditRepair),
			false
		);
	}
});

test('a repeated structural issue never triggers a second rewrite', async () => {
	const input = fixture();
	const { model, calls } = modelFor(input, {
		change({ request, output }) {
			if (request.stage !== 'audit') return;
			output.issues = ['DUPLICATE_TOPIC'];
			output.topicRepairs = [
				{ issue: 'DUPLICATE_TOPIC', editTopics: ['A2'], instruction: 'Keep the wish in A1 only.' }
			];
		}
	});
	await assert.rejects(
		assessSelfTopics(input, model, allow),
		(error) => error.reason === 'DUPLICATE_TOPIC' && error.diagnostic.attempt === 2
	);
	assert.equal(calls.filter((call) => call.data.auditRepair).length, 1);
	assert.equal(calls.filter((call) => call.stage === 'audit').length, 2);
});

test('audit repair cannot borrow a citation or change the topic effect', async () => {
	for (const reason of ['OUT_OF_TOPIC_EVIDENCE', 'TOPIC_REVISION_SCOPE']) {
		const input = fixture();
		const { model, calls } = modelFor(input, {
			change({ request, data, output }) {
				if (data.auditRepair) {
					if (reason === 'OUT_OF_TOPIC_EVIDENCE') output.meanings[0].evidence[0].turnId = 'T1';
					else output.timeScope = 'CURRENT';
				}
				if (request.stage !== 'audit') return;
				output.issues = ['OMITTED_MEANING'];
				output.topicRepairs = [
					{
						issue: 'OMITTED_MEANING',
						editTopics: ['A2'],
						instruction: 'Preserve why the conversation mattered.'
					}
				];
			}
		});
		await assert.rejects(assessSelfTopics(input, model, allow), (error) => error.reason === reason);
		assert.equal(calls.filter((call) => call.data.auditRepair).length, 1);
		assert.equal(calls.filter((call) => call.stage === 'audit').length, 1);
	}
});
