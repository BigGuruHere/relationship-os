// Runs inside the disposable LUR-2 fixture and exercises the real model gateway
// through a synthetic transport. All repository operations use the guarded client.
import assert from 'node:assert/strict';

function turnCapture(id, date, text) {
	return {
		format: 'conversation-v1',
		binding: { provider: 'ELEVENLABS', conversationId: 'conv_' + id, agentId: 'synthetic-agent' },
		occurredAt: date,
		completeness: 'COMPLETE',
		turns: [
			{ id: 'T1', role: 'AGENT', text: 'Would mornings work for your regular catch-ups?' },
			{ id: 'T2', role: 'OWNER', text }
		]
	};
}

export async function runLuAssessmentCases({ load, grant, personId, conversations, lu, count }) {
	const { assessFoundationConversation } = await load('server/foundation/luAssessment');
	const owner = { user: { id: 'other' } };
	const save = await grant('SAVE_CONVERSATION', 'other');
	const revise = await grant('REVISE_CONVERSATION_SOURCE', 'other');
	const prepare = await grant('PREPARE_LU', 'other');
	const store = await grant('STORE_LU_CANDIDATE', 'other');
	const approve = await grant('APPROVE_LU', 'other');
	const read = await grant('READ_LU', 'other');
	const first = (
		await conversations.savePersonConversation(
			save,
			personId,
			turnCapture('assessment_first', '2026-11-10T03:00:00Z', 'Yes, mornings are best for me.'),
			'First private summary',
			{ kind: 'HUMAN_AUTHORED' }
		)
	).sourceId;
	const next = (
		await conversations.savePersonConversation(
			save,
			personId,
			turnCapture('assessment_next', '2026-11-11T03:00:00Z', 'Only on weekends now.'),
			'Second private summary',
			{ kind: 'HUMAN_AUTHORED' }
		)
	).sourceId;
	const quiet = (
		await conversations.savePersonConversation(
			save,
			personId,
			turnCapture('assessment_quiet', '2026-11-11T04:00:00Z', 'Thanks, Dorian.'),
			'Short private summary',
			{ kind: 'HUMAN_AUTHORED' }
		)
	).sourceId;
	const calls = [];
	const previousFetch = globalThis.fetch;
	const env = ['DATING_REVISION_MODEL', 'OPENAI_API_KEY'];
	const previousEnv = Object.fromEntries(env.map((key) => [key, process.env[key]]));
	let phase = 'initial';
	let beforeResponse;
	process.env.DATING_REVISION_MODEL = 'synthetic-lu-model';
	process.env.OPENAI_API_KEY = 'synthetic-intercepted-lu-key';
	globalThis.fetch = async (url, init) => {
		assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
		const body = JSON.parse(init.body);
		assert.equal(body.model, 'synthetic-lu-model');
		const prompt = body.messages[1].content.split(
			'\n\nReturn strict JSON matching this schema:'
		)[0];
		const data = JSON.parse(prompt);
		const stage = data.draft ? 'audit' : data.decomposition ? 'compose' : 'decompose';
		calls.push({ stage, data });
		if (beforeResponse) await beforeResponse(stage);
		let output;
		if (stage === 'decompose') {
			const [agent, answer] = data.source.turns;
			assert.equal(agent.role, 'AGENT');
			assert.equal(answer.role, 'OWNER');
			output =
				phase === 'quiet'
					? {
							meanings: [],
							exclusions: [{ turnId: 'T2', reason: 'CONVERSATIONAL' }],
							unresolvedMentions: []
						}
					: {
							meanings: [
								{
									id: 'M1',
									destination: 'D1',
									area: 'Friendships',
									topic: 'Catch-up time',
									text: answer.text,
									kind: 'PREFERENCE',
									basis: 'DIRECT_ACCOUNT',
									confidence: 'HIGH',
									uncertainty: null,
									evidence: [
										{ turnId: agent.id, quote: agent.text, role: 'CONTEXT' },
										{ turnId: answer.id, quote: answer.text, role: 'SUPPORTS' }
									]
								}
							],
							exclusions: [],
							unresolvedMentions: []
						};
		} else if (stage === 'compose') {
			const topic = {
				destination: 'D1',
				area: 'Friendships',
				title: 'Catch-up time',
				primary: ['M1'],
				contextual: [],
				retire: [],
				timeScope: 'CURRENT'
			};
			output = {
				topics:
					phase === 'quiet'
						? data.prior.map((p) => ({
								...topic,
								destination: p.destination,
								prior: p.ref,
								effect: 'UNCHANGED',
								prose: null,
								timeScope: null,
								primary: []
							}))
						: [
								{
									...topic,
									prior: data.prior[0]?.ref ?? null,
									effect: data.prior.length ? 'QUALIFIED' : 'NEW',
									prose: data.prior.length
										? 'Prefers mornings for catch-ups, on weekends only now.'
										: 'Prefers mornings for regular catch-ups.'
								}
							]
			};
		} else output = { issues: [] };
		return Response.json({ choices: [{ message: { content: JSON.stringify(output) } }] });
	};
	const assess = (id, key) => assessFoundationConversation(owner, personId, id, key);
	async function apply(id, key, reviewKey) {
		const input = await lu.prepareLuAssessment(prepare, personId, id);
		const receipt = await lu.resumeLuAssessment(store, personId, input, key);
		assert.equal(receipt.provenance.invocations.length, 3);
		assert.ok(receipt.provenance.invocations.every((inv) => inv.model === 'synthetic-lu-model'));
		const { candidate } = receipt;
		assert.equal(
			candidate.meanings[0].generation.invocationId,
			receipt.provenance.invocations[0].invocationId
		);
		await lu.approveLuCandidate(approve, receipt.candidateId, {
			requestKey: reviewKey,
			decision: 'APPROVE',
			selected: candidate.streams.flatMap((s) =>
				s.topics.map((t) => ({
					subjectId: s.subjectId,
					perspectiveId: s.perspectiveId,
					topicKey: t.key
				}))
			)
		});
		return input.packet.destinations[0];
	}
	try {
		await assert.rejects(assess(first, 'initial'), /unavailable/);
		assert.equal(calls.length, 0);
		await conversations.reviseConversationSource(revise, personId, first, 1, 'PRIVATE_ANALYSIS');
		await conversations.reviseConversationSource(revise, personId, next, 1, 'PRIVATE_ANALYSIS');
		await conversations.reviseConversationSource(revise, personId, quiet, 1, 'PRIVATE_ANALYSIS');
		const ready = await assess(first, 'initial');
		assert.equal(ready.outcome, 'READY');
		assert.equal(calls.length, 3);
		assert.deepEqual(await assess(first, 'initial'), ready);
		assert.equal(calls.length, 3);
		assert.equal(await count('FoundationLuRevision'), 0);
		const destination = await apply(first, 'initial', 'approval-first');
		const v1 = await lu.readLuRevision(read, destination);
		assert.equal(v1.topics[0].effect, 'NEW');
		phase = 'followup';
		assert.equal((await assess(next, 'followup')).outcome, 'READY');
		await apply(next, 'followup', 'approval-second');
		const v2 = await lu.readLuRevision(read, destination);
		assert.equal(v2.revisionNumber, 2);
		assert.equal(v2.topics[0].effect, 'QUALIFIED');
		assert.equal(v2.topics[0].meaningVersionIds[0], v1.topics[0].meaningVersionIds[0]);
		assert.deepEqual(await lu.readLuRevision(read, destination, 1), v1);
		phase = 'quiet';
		const noChange = await assess(quiet, 'quiet');
		assert.equal(noChange.outcome, 'NO_CHANGE');
		assert.deepEqual(await assess(quiet, 'quiet'), noChange);
		assert.equal(await count('FoundationLuRevision'), 2);

		phase = 'followup';
		const pending = await assess(next, 'pending-review');
		// Change eligibility without changing the current topic head or current source.
		const before = await count('FoundationLuCandidate');
		beforeResponse = async () => {
			beforeResponse = undefined;
			await conversations.reviseConversationSource(revise, personId, first, 2, 'STORED_ONLY');
		};
		const beforeCalls = calls.length;
		await assert.rejects(assess(next, 'permission-change'), /conflicts/);
		assert.equal(calls.length, beforeCalls + 1);
		assert.equal(await count('FoundationLuCandidate'), before);
		await assert.rejects(assess(quiet, 'quiet'), /conflicts/);
		assert.equal(await lu.readLuRevision(read, destination), null);
		await assert.rejects(
			lu.approveLuCandidate(approve, pending.candidateId, {
				requestKey: 'stale-approval',
				decision: 'APPROVE',
				selected: [
					{
						subjectId: destination.subjectId,
						perspectiveId: destination.perspectiveId,
						topicKey: 'P1'
					}
				]
			}),
			/conflicts/
		);
		beforeResponse = async () => {
			beforeResponse = undefined;
			await conversations.reviseConversationSource(revise, personId, next, 2, 'STORED_ONLY');
		};
		await assert.rejects(assess(next, 'current-source-withdrawal'), /unavailable/);
		assert.equal(await count('FoundationLuCandidate'), before);
		assert.equal(await count('FoundationLuRevision'), 2);
	} finally {
		globalThis.fetch = previousFetch;
		for (const key of env) {
			if (previousEnv[key] === undefined) delete process.env[key];
			else process.env[key] = previousEnv[key];
		}
	}
}
