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
		if (request.stage === 'decompose' && data.prior.length)
			output.topicEffects = data.prior.map((p) => {
				const a = output.areas.find((a) => a.existingTopicId === p.existingTopicId);
				return { existingTopicId: p.existingTopicId, effect: a ? 'EXPANDED' : 'UNCHANGED', reason: 'Synthetic impact assessment', relevantTurnIds: a?.relevantTurnIds ?? [] };
			});
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
	const { model, calls } = modelFor(input, {
		change({ request, data, output }) {
			if (request.stage === 'decompose' && !data.correction) {
				// A real private topic ID is not the model's run-local saved topic reference.
				output.areas[0].existingTopicId = 'mentor';
			}
		}
	});
	const trace = { stages: [], audits: [], repairs: [] };
	const result = await assessSelfTopics(input, model, allow, undefined, trace);
	assert.deepEqual(calls[0].data.allowedExistingTopicIds, ['P1']);
	assert.equal(calls[0].data.prior[0].existingTopicId, 'P1');
	assert.deepEqual(
		calls.slice(0, 2).map((call) => call.stage),
		['decompose', 'decompose']
	);
	assert.match(calls[1].data.correction, /copy an allowed existingTopicId/);
	assert.deepEqual(
		trace.stages.slice(0, 2).map(({ stage, attempt, outcome }) => ({ stage, attempt, outcome })),
		[
			{ stage: 'decompose', attempt: 1, outcome: 'DISCOVERY_UNKNOWN_TOPIC' },
			{ stage: 'decompose', attempt: 2, outcome: 'COMPLETED' }
		]
	);
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
			'DISCOVERY_INVALID_TURN',
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
			'DISCOVERY_OMITTED_OWNER_TURN',
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
				assert.deepEqual(Object.keys(request.outputSchema.properties).sort(), [
					'meanings',
					'prose',
					'title'
				]);
				output.title = 'Musical theatre plans';
				// Protected revision metadata is ignored even if a provider sends it.
				output.effect = 'SUPERSEDED';
				output.timeScope = 'CURRENT';
				output.retire = [{ meaning: 'unrelated-prior', reason: 'Do not apply.' }];
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
				assert.equal(data.draft[1].effect, 'NEW');
				assert.equal(data.draft[1].timeScope, 'MIXED');
				assert.deepEqual(data.draft[1].retire, []);
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

test('audit repair cannot borrow a citation from another topic', async () => {
	const input = fixture();
	const { model, calls } = modelFor(input, {
		change({ request, data, output }) {
			if (data.auditRepair) output.meanings[0].evidence[0].turnId = 'T1';
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
	await assert.rejects(
		assessSelfTopics(input, model, allow),
		(error) => error.reason === 'OUT_OF_TOPIC_EVIDENCE'
	);
	assert.equal(calls.filter((call) => call.data.auditRepair).length, 1);
	assert.equal(calls.filter((call) => call.stage === 'audit').length, 1);
});

test('a rejected discovery records bounded private diagnostics and never reaches writing', async () => {
	const input = fixture();
	const { model, calls } = modelFor(input, {
		change({ request, output }) {
			if (request.stage !== 'decompose') return;
			// A shape-valid new topic with a blank label is not a usable discovery result.
			output.areas[0].suggestedTopic = ' ';
		}
	});
	const panels = [];
	await assert.rejects(
		assessSelfTopics(input, model, allow, undefined, undefined, panels),
		(err) => {
			assert.equal(err.reason, 'DISCOVERY_MISSING_LABEL');
			assert.deepEqual(err.diagnostic, { stage: 'decompose', attempt: 2 });
			return true;
		}
	);
	assert.deepEqual(
		calls.map((call) => call.stage),
		['decompose', 'decompose']
	);
	assert.deepEqual(
		panels.map((panel) => panel.items[0].title),
		['Discovery needs correction', 'Discovery held']
	);
	assert.ok(panels.every((panel) => panel.reason === 'DISCOVERY_MISSING_LABEL'));
});

test('topic drafting grounds separate exact excerpts and falls back when the proposed wording is not verbatim', async () => {
	const input = fixture([
		['agent', 'What do you recall?'],
		[
			'owner',
			'Sam was my mentor. I changed jobs that year. Sam died, I don’t know, maybe five years ago.'
		],
		[
			'owner',
			'My daughter applied to three colleges. She has one offer and two pending applications.'
		],
		['agent', 'Would you like her to accept?'],
		['owner', 'Maybe, but I really do not know.']
	]);
	const excerpts = ['Sam was my mentor.', 'Sam died, I don’t know, maybe five years ago.'];
	const { model, calls } = modelFor(input, {
		change({ request, data, output }) {
			if (request.stage !== 'compose') return;
			if (data.area.title === 'Mentorship and reconnection') {
				output.prose = 'Sam was my mentor and died perhaps five years ago.';
				output.meanings = [
					{
						...meaning(output.prose, 'T1'),
						evidence: excerpts.map((quote) => ({ turnId: 'T1', quote, role: 'SUPPORTS' }))
					}
				];
			} else {
				output.meanings[0].evidence[0].quote = 'She received a college offer.';
			}
		}
	});
	const { candidate } = await assessSelfTopics(input, model, allow);
	const [mentor, daughter] = candidate.meanings;
	assert.deepEqual(
		mentor.evidence.map((item) => item.quote),
		excerpts
	);
	for (const item of mentor.evidence)
		assert.equal(input.packet.text.slice(item.start, item.end), item.quote);
	assert.equal(
		daughter.evidence[0].quote,
		'My daughter applied to three colleges. She has one offer and two pending applications.'
	);
	const audit = calls.find((call) => call.stage === 'audit').data;
	assert.deepEqual(
		audit.meanings[0].evidence.map((item) => item.quote),
		excerpts
	);
	assert.equal(audit.meanings[1].evidence[0].quote, null);
});

test('structural repair merges a redundant draft while preserving related topics and source evidence', async () => {
	const input = fixture([
		['owner', 'I am developing a contact tool that lets people save details and exchange them back.'],
		['agent', 'Which aspect feels most exciting or challenging?'],
		['owner', 'The contact exchange.'],
		['owner', 'Eventually I want the contact tool and my conversational assistant to work as one system.'],
		['owner', 'I am building the assistant to understand what people want and who they want to meet.']
	]);
	const { model, calls } = modelFor(input, {
		change({ request, data, output }) {
			if (request.stage === 'decompose') {
				output.areas = [
					area('Contact exchange tool', ['T0']),
					area('Current work focus', ['T2']),
					area('Combined system vision', ['T3']),
					area('Conversational assistant', ['T4'])
				];
				output.exclusions = [];
			}
			if (data.auditRepair?.mergedDrafts) {
				assert.deepEqual(data.allowedCitations.owner, ['T0', 'T2']);
				assert.deepEqual(data.allowedCitations.contextOnly, ['T1']);
				assert.equal(data.auditRepair.mergedDrafts.length, 2);
				output.prose = 'The owner is developing a tool to save and reciprocally share contact details. They selected contact exchange when asked what felt most exciting or challenging.';
				output.meanings.push(meaning('They selected contact exchange in reply to that question.', 'T2'));
				output.meanings.at(-1).evidence.push({ turnId: 'T1', quote: null, role: 'CONTEXT' });
			}
			if (request.stage !== 'audit') return;
			if (!data.mergedFrom) {
				output.issues = ['DUPLICATE_TOPIC', 'UNSUPPORTED_PROSE'];
				output.findings = ['Keep the answer with the contact topic and preserve what the question asked.'];
				output.topicMerge = { keep: 'A1', absorb: ['A2'], instruction: 'Combine the contact tool with the answer about it.' };
				output.topicRepairs = [{ issue: 'UNSUPPORTED_PROSE', editTopics: ['A1'], instruction: 'Avoid inferring how the owner allocates time.' }];
			} else {
				assert.deepEqual(data.draft.map((topic) => topic.topicRef), ['A1', 'A3', 'A4']);
				assert.equal(data.mergedFrom.length, 2);
			}
		}
	});
	const result = await assessSelfTopics(input, model, allow);
	assert.deepEqual(result.candidate.streams[0].topics.map((topic) => topic.title),
		['Contact exchange tool', 'Combined system vision', 'Conversational assistant']);
	assert.equal(calls.filter((call) => call.data.auditRepair).length, 1);
	assert.ok(result.candidate.meanings.some((claim) =>
		claim.evidence.some((citation) => citation.turnId === 'T2' && citation.role === 'SUPPORTS') &&
		claim.evidence.some((citation) => citation.turnId === 'T1' && citation.role === 'CONTEXT')));
});

test('a held structural review resumes without repeating successful discovery and writing', async () => {
	const input = fixture();
	let checkpoint;
	const held = modelFor(input, {
		change({ request, output }) {
			if (request.stage === 'audit') output.issues = ['MISATTRIBUTION'];
		}
	});
	await assert.rejects(assessSelfTopics(input, held.model, allow, undefined, undefined, [], {
		save(value) { checkpoint = JSON.parse(JSON.stringify(value)); }
	}), /MISATTRIBUTION/);
	assert.ok(checkpoint);
	const resumed = modelFor(input);
	const result = await assessSelfTopics(input, resumed.model, allow, undefined, undefined, [], {
		checkpoint, save() {}
	});
	assert.deepEqual(resumed.calls.map((call) => call.stage), ['audit']);
	assert.ok(result.candidate.meanings.every((claim) => claim.generation.promptVersion === checkpoint.version));
	assert.deepEqual(result.provenance.invocations.map((call) => call.stage), ['decompose', 'compose', 'compose', 'audit']);
	assert.ok(result.provenance.stageReview.some((panel) =>
		panel.items.some((item) => item.title === 'Structural review resumed')));
});

test('a new omission found on re-audit is repaired automatically using the latest draft', async () => {
	const input = fixture();
	let auditCount = 0;
	const { model, calls } = modelFor(input, {
		change({ request, data, output }) {
			if (data.auditRepair) {
				if (data.auditRepair.findings[0].newFinding) {
					assert.match(data.auditRepair.previous.prose, /family again/);
					output.prose = 'Sam was my mentor and felt like a father to me. Meeting his family again felt meaningful. I hope to stay in touch.';
				} else {
					output.prose = 'Sam was my mentor and felt like a father to me. Meeting his family again felt meaningful.';
				}
			}
			if (request.stage !== 'audit') return;
			if (++auditCount === 1) {
				output.issues = ['OMITTED_MEANING'];
				output.topicRepairs = [{
					issue: 'OMITTED_MEANING', editTopics: ['A1'], instruction: 'Restore that meeting the family again felt meaningful.'
				}];
			} else if (auditCount === 2) {
				assert.equal(data.previousRepairs[0].editTopics[0], 'A1');
				output.issues = ['OMITTED_MEANING'];
				output.topicRepairs = [{
					issue: 'OMITTED_MEANING', editTopics: ['A1'], instruction: 'Restore the hope to stay in touch (T1).',
					newFinding: true
				}];
			}
		}
	});
	const result = await assessSelfTopics(input, model, allow);
	assert.deepEqual(calls.filter((call) => call.data.auditRepair).map((call) => call.data.area.title),
		['Mentorship and reconnection', 'Mentorship and reconnection']);
	assert.equal(auditCount, 3);
	assert.match(result.candidate.streams[0].topics[0].prose, /hope to stay in touch/);
});

test('persistent findings are held after the final audit', async () => {
	const input = fixture();
	let auditCount = 0;
	const { model, calls } = modelFor(input, {
		change({ request, output }) {
			if (request.stage !== 'audit') return;
			output.issues = ['UNSUPPORTED_PROSE'];
			output.topicRepairs = [{
				issue: 'UNSUPPORTED_PROSE',
				editTopics: ['A1'],
				newFinding: true,
				instruction: 'Correct unsupported interpretation ' + (++auditCount)
			}];
		}
	});
	await assert.rejects(assessSelfTopics(input, model, allow),
		(error) => error.reason === 'UNSUPPORTED_PROSE' && error.diagnostic.attempt === 3);
	assert.equal(calls.filter((call) => call.data.auditRepair).length, 2);
	assert.equal(auditCount, 3);
});

// One supported turn contains two independently evolving areas. Mapping retains
// evidence and original generation metadata while the audit writes new topic prose.
test('structural mapping splits and reclassifies drafts without losing evidence provenance', async () => {
 const input = fixture();
 let audits = 0;
 const { model, calls } = modelFor(input, { change({ request, data, output }) {
  if (request.stage === 'compose' && data.area.title === 'Mentorship and reconnection') {
   output.meanings = [meaning('Sam was my mentor and felt like a father to me.', 'T1'), meaning('I hope to stay in touch with his family.', 'T1')];
  }
  if (request.stage === 'audit' && ++audits === 1) {
   output.issues = ['DUPLICATE_TOPIC'];
   output.topicRestructure = [
    { title: 'Mentorship', realm: 'Personal history', prose: 'Sam was my mentor and felt like a father to me.', timeScope: 'HISTORICAL', meaningRefs: ['A1M1'] },
    { title: 'Reconnecting with family', realm: 'Connections', prose: 'Meeting his family again felt meaningful. I hope to stay in touch.', timeScope: 'CURRENT', meaningRefs: ['A1M2'] },
    { title: 'Supporting my daughter', realm: 'Family', prose: 'My daughter is applying to music colleges. I want to understand her options so I can support her.', timeScope: 'CURRENT', meaningRefs: ['A2M1'] }
   ];
  }
 }});
 const result = await assessSelfTopics(input, model, allow);
 assert.equal(audits, 2);
 assert.equal(result.candidate.streams[0].topics.length, 3);
 assert.equal(result.candidate.meanings.length, 3);
 assert.deepEqual(result.candidate.meanings.map(m => m.generation.invocationId), ['synthetic-2', 'synthetic-2', 'synthetic-3']);
 assert.ok(result.candidate.meanings.every(m => m.evidence.length));
 assert.equal(calls.at(-1).data.preservationDrafts.length, 2);
 assert.equal(calls.at(-1).data.mergedFrom.length, 2);
});

test('structural mapping rejects missing, duplicate and invented meaning references', async () => {
 for (const refs of [['A1M1'], ['A1M1', 'A1M1'], ['A1M1', 'A9M1']]) {
  const input = fixture();
  const { model } = modelFor(input, { change({ request, output }) {
   if (request.stage === 'audit') {
    output.issues = ['DUPLICATE_TOPIC'];
    output.topicRestructure = [{ title: 'Combined', realm: 'Life', prose: 'A proposed combined understanding.', timeScope: 'CURRENT', meaningRefs: refs }];
   }
  }});
  await assert.rejects(assessSelfTopics(input, model, allow), /STRUCTURE_COVERAGE/);
 }
});

test('a structural rewrite must pass an independent source audit', async () => {
 const input = fixture();
 let audits = 0;
 const { model } = modelFor(input, { change({ request, output }) {
  if (request.stage !== 'audit') return;
  if (++audits === 1) {
   output.issues = ['DUPLICATE_TOPIC'];
   output.topicRestructure = [{ title: 'Life', realm: 'Life', prose: 'Unsupported gendered or overconfident interpretation.', timeScope: 'CURRENT', meaningRefs: ['A1M1', 'A2M1'] }];
  } else output.issues = ['MISATTRIBUTION'];
 }});
 await assert.rejects(assessSelfTopics(input, model, allow), /MISATTRIBUTION/);
 assert.equal(audits, 2);
});

test('older checkpoints re-run discovery under the complete impact contract', async () => {
 const input = fixture();
 let checkpoint;
 const held = modelFor(input, { change({ request, output }) {
  if (request.stage === 'audit') output.issues = ['MISATTRIBUTION'];
 }});
 await assert.rejects(assessSelfTopics(input, held.model, allow, undefined, undefined, [], { save(c) { checkpoint = structuredClone(c); } }));
 checkpoint.version = 'foundation-self-topics-v8';
 const resumed = modelFor(input);
 await assessSelfTopics(input, resumed.model, allow, undefined, undefined, [], { checkpoint, save() {} });
 assert.equal(resumed.calls[0].stage, 'decompose');
});

function withSelfBaseline(input) {
 input.prior = [{ subjectId: 'self', perspectiveId: input.packet.baselines.find(b => b.subjectId === 'self').perspectiveId,
  topicId: 'mentor', versionId: 'mentor-v1', area: 'Personal life', title: 'Mentorship',
  prose: 'Sam was my mentor.', timeScope: 'HISTORICAL', sourceAt: null,
  meanings: [{ versionId: 'mentor-m1', text: 'Sam was my mentor.' }] }];
 const baseline = input.packet.baselines.find(b => b.subjectId === 'self');
 baseline.revisionId = 'self-v1';
 baseline.topics = [{ topicId: 'mentor', versionId: 'mentor-v1', meaningVersionIds: ['mentor-m1'] }];
 return input;
}

test('reinforcement preserves accepted prose and historical scope while adding evidence', async () => {
 const input = withSelfBaseline(fixture());
 const { model } = modelFor(input, { change({ request, data, output }) {
  if (request.stage === 'decompose') output.topicEffects[0].effect = 'REINFORCED';
  if (request.stage === 'compose' && data.prior) output.effect = 'REINFORCED';
 }});
 const result = await assessSelfTopics(input, model, allow);
 const topic = result.candidate.streams.find(s => s.subjectId === 'self').topics[0];
 assert.equal(topic.prose, 'Sam was my mentor.');
 assert.equal(topic.timeScope, 'HISTORICAL');
 assert.deepEqual(topic.retainedMeaningVersionIds, ['mentor-m1']);
 assert.ok(topic.meaningIds.length);
});

test('impact review rejects omitted, duplicate and mismatched saved-topic dispositions', async () => {
 for (const mutate of [o => o.topicEffects = [], o => o.topicEffects.push(o.topicEffects[0]), o => o.topicEffects[0].effect = 'UNCHANGED']) {
  const input = withSelfBaseline(fixture());
  const { model, calls } = modelFor(input, { change({ request, output }) { if (request.stage === 'decompose') mutate(output); } });
  await assert.rejects(assessSelfTopics(input, model, allow), /IMPACT_COVERAGE/);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(c => c.stage === 'decompose'));
 }
});

test('contradiction preserves prior meaning and rejects a writer changing the reviewed effect', async () => {
 const input = withSelfBaseline(fixture());
 const setup = wrong => modelFor(input, { change({ request, data, output }) {
  if (request.stage === 'decompose') output.topicEffects[0].effect = 'CONTRADICTED';
  if (request.stage === 'compose' && data.prior) output.effect = wrong ? 'SUPERSEDED' : 'CONTRADICTED';
 }});
 const result = await assessSelfTopics(input, setup(false).model, allow);
 const topic = result.candidate.streams[0].topics[0];
 assert.equal(topic.effect, 'CONTRADICTED');
 assert.deepEqual(topic.retainedMeaningVersionIds, ['mentor-m1']);
 await assert.rejects(assessSelfTopics(input, setup(true).model, allow), /BAD_EFFECT/);
});

test('the product-vision regression retains earlier corrections when a later audit repairs qualification', async () => {
 // Reduced replay of the owner's supplied Dorian conversation. Provider responses
 // are scripted so this tests repair orchestration, not live model fidelity.
 const input = fixture([
  ['agent', 'Which part feels most exciting or challenging to work on right now?'],
  ['owner', 'The second part.'],
  ['owner', 'I invented and developed Dorian. Relish lets someone scan a QR code, save my details in their phone, and share their own details. Dorian should understand what people want and whom they want to connect with. Eventually they could completely manage human relationships.'],
  ['owner', 'You have got to like each other at a basic level. A joint goal is also very powerful.']
 ]);
 let audits = 0;
 const corrected = 'The owner says they invented and developed Dorian. Relish supports QR contact exchange, saving details in a phone and reciprocal sharing. Dorian should understand what people want and whom they wish to connect with. Their aspiration is eventually to completely manage human relationships. They selected the conversational part when asked what felt most exciting or challenging, without distinguishing between the two.';
 const calls = [];
 const model = async request => {
  const data = JSON.parse(request.userPrompt);
  calls.push(data);
  let output;
  if (request.stage === 'decompose') output = { areas: [area('Product vision', ['T1', 'T2']), area('Collaboration', ['T3'])], exclusions: [], unresolvedMentions: [] };
  else if (request.stage === 'compose') {
   const product = data.area.title === 'Product vision';
   output = { prose: product ? (data.auditRepair ? corrected : 'The owner is excited by the conversational product.') :
     (data.auditRepair ? 'The owner considers basic mutual liking necessary and a joint goal powerful.' : 'Basic mutual liking is a possible component.'),
    effect: 'NEW', timeScope: 'CURRENT', retire: [],
    meanings: product ? [meaning('The second part.', 'T1'), meaning(corrected, 'T2')] : [meaning('Basic mutual liking is necessary; a joint goal is powerful.', 'T3')] };
  } else {
   audits++;
   output = { issues: [], findings: [] };
   if (audits === 1) {
    output.issues = ['UNSUPPORTED_PROSE'];
    output.topicRepairs = [{ issue: 'UNSUPPORTED_PROSE', editTopics: ['A1'], instruction: 'Restore inventor role, reciprocal QR exchange, desired connections and aspirational full scope. Preserve exciting-or-challenging ambiguity.' }];
   } else if (audits === 2) {
    assert.equal(data.draft[0].prose, corrected);
    output.issues = ['LOST_QUALIFICATION'];
    output.topicRepairs = [{ issue: 'LOST_QUALIFICATION', editTopics: ['A2'], instruction: 'Preserve that basic mutual liking is needed, rather than merely possible.', newFinding: true }];
   } else {
    assert.equal(data.draft[0].prose, corrected);
    assert.match(data.draft[1].prose, /necessary/);
    assert.equal(data.repairHistory.length, 2);
    assert.equal(data.preservationDrafts.length, 2);
   }
  }
  return { output, invocationId: 'regression-' + calls.length, model: 'synthetic' };
 };
 const result = await assessSelfTopics(input, model, allow);
 assert.equal(audits, 3);
 assert.equal(result.candidate.streams[0].topics[0].prose, corrected);
});

test('deterministic duplicate prose reaches structural review but cannot be passed by model approval', async () => {
 const input = fixture();
 let audits = 0;
 const { model } = modelFor(input, { change({ request, data, output }) {
  if (request.stage === 'compose') output.prose = 'A sufficiently long identical sentence repeats the same primary understanding across two topics.';
  if (request.stage === 'audit') { audits++; assert.equal(data.structuralFailure, 'DUPLICATE_TOPIC_PROSE'); }
 }});
 await assert.rejects(assessSelfTopics(input, model, allow), /DUPLICATE_TOPIC/);
 assert.equal(audits, 1);
});

test('draft restructuring cannot absorb a saved topic or its assertions', async () => {
 const input = withSelfBaseline(fixture());
 const { model } = modelFor(input, { change({ request, output }) {
  if (request.stage === 'audit') {
   output.issues = ['DUPLICATE_TOPIC'];
   output.topicRestructure = [{ title: 'Combined', realm: 'Life', prose: 'A combined topic.', timeScope: 'MIXED', meaningRefs: ['A1M1', 'A2M1'] }];
  }
 }});
 await assert.rejects(assessSelfTopics(input, model, allow), /STRUCTURE_COVERAGE/);
});
