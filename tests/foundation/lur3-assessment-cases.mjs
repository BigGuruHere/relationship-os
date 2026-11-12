// Runs inside the disposable LUR-2 fixture and exercises the real model gateway
// through a synthetic transport. All repository operations use the guarded client.
import assert from 'node:assert/strict';
import { reviewBrowser } from '../browser/lu-review-forms.mjs';

function turnCapture(id, date, text) {
	return {
		format: 'conversation-v1',
		binding: { provider: 'ELEVENLABS', conversationId: 'conv_' + id, agentId: 'synthetic-agent' },
		occurredAt: date,
		completeness: 'COMPLETE',
		turns: [
			{ id: 'T1', role: 'AGENT', text: 'Would mornings work for your regular catch-ups?' },
			{ id: 'T2', role: 'OWNER', text },
			...(id === 'assessment_first' ? [
				{ id: 'T3', role: 'OWNER', text: 'I find this friend easy to talk to.' },
				{ id: 'T4', role: 'OWNER', text: 'I want to see this friend more often.' }
			] : [])
		]
	};
}

export async function runLuAssessmentCases({ load, vite, otherPersonId, grant, personId, conversations, lu, count }) {
	const { assessFoundationConversation } = await load('server/foundation/luAssessment');
	const route = await vite.ssrLoadModule('/src/routes/people/[id]/notes/[noteId]/review/+page.server.ts');
	const owner = { user: { id: 'other', role: 'owner' }, env: 'dev', sessionId: 'fixture-session' };
	let browser;
	let origin = 'https://dev.relish.live';
	const pathname = (id) => '/people/' + personId + '/notes/' + id + '/review';
	const event = (id, query = '', locals = owner, params = { id: personId, noteId: id }) => ({
		url: new URL(pathname(id) + '?conversation=1' + query, origin),
		locals, params, setHeaders() {}
	});
	const action = (name, id, fields, query, locals = owner, requestOrigin = origin) => {
		const input = event(id, query, locals);
		return route.actions[name]({ ...input, request: new Request(input.url, {
			method: 'POST', headers: { origin: requestOrigin }, body: new URLSearchParams(fields)
		}) });
	};
	const status = (code) => (cause) => cause.status === code;
	async function redirectTo(promise) {
		try { await promise; } catch (cause) {
			assert.equal(cause.status, 303);
			return new URL(cause.location, origin);
		}
		assert.fail('Expected review redirect');
	}
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
	const env = ['DATING_REVISION_MODEL', 'OPENAI_API_KEY', 'RELISH_FOUNDATION_LU_REVIEW', 'APP_ORIGIN_DEV'];
	const previousEnv = Object.fromEntries(env.map((key) => [key, process.env[key]]));
	let phase = 'initial';
	let beforeResponse;
	let rejectEdit = false;
	let rejectAssessment = false;
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
		const stage = data.topic ? 'edit-audit' : data.draft ? 'audit' : data.decomposition ? 'compose' : 'decompose';
		calls.push({ stage, data });
		if (beforeResponse) await beforeResponse(stage, init.signal);
		let output;
		if (stage === 'decompose') {
			const [agent, answer, ...additional] = data.source.turns;
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
										{ turnId: agent.id, quote: null, role: 'CONTEXT' },
										{ turnId: answer.id, quote: null, role: 'SUPPORTS' }
									]
								},
								...additional.map((turn, index) => ({
									id: 'M' + (index + 2), destination: 'D' + (index + 2),
									area: 'Friendships', topic: index === 0 ? 'Conversation' : 'Time together',
									text: turn.text, kind: index === 0 ? 'OTHER' : 'WANT',
									basis: index === 0 ? 'EXPRESSED_OPINION' : 'DIRECT_ACCOUNT', confidence: 'HIGH', uncertainty: null,
									evidence: [{ turnId: turn.id, quote: turn.text, role: 'SUPPORTS' }]
								}))
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
								},
								...data.decomposition.meanings.slice(1).map((meaning) => ({
									...topic, destination: meaning.destination, title: meaning.topic,
									prior: null, effect: 'NEW', prose: meaning.text, primary: [meaning.id]
								}))
							]
			};
		} else if (stage === 'audit' && rejectAssessment) {
			output = {
				issues: ['MISATTRIBUTION'],
				attributionFindings: [{ target: 'TOPIC', topicIndex: 0, issue: 'ONE_SIDED_AS_SHARED' }]
			};
		} else output = { issues: stage === 'edit-audit' && rejectEdit ? ['UNSUPPORTED_PROSE'] : [] };
		return Response.json({ choices: [{ message: { content: JSON.stringify(output) } }] });
	};
	const assess = (id, key) => assessFoundationConversation(owner, personId, id, key);
	async function analyse(id, { browserFlow = false } = {}) {
		if (browser && browserFlow) {
			await browser.page.goto(origin + pathname(id) + '?conversation=1');
			await browser.page.getByRole('button', { name: 'Analyse conversation' }).click();
			await browser.page.waitForURL(/candidate=/);
			return new URL(browser.page.url()).searchParams.get('candidate');
		}
		const current = await route.load(event(id));
		const fields = { sourceVersion: String(current.conversation.sourceVersion), requestKey: current.requestKey };
		const result = await redirectTo(action('assessConversation', id, fields));
		const beforeReplay = calls.length;
		assert.equal(String(await redirectTo(action('assessConversation', id, {
			...fields, sourceVersion: String((await route.load(event(id))).conversation.sourceVersion)
		}))), String(result));
		assert.equal(calls.length, beforeReplay);
		return result.searchParams.get('candidate');
	}
	async function approveTopic(id, candidate, key) {
		if (browser) {
			await browser.page.goto(origin + pathname(id) + '?conversation=1&candidate=' + candidate);
			await browser.page.getByRole('checkbox', { name: 'Approve Catch-up time' }).check();
			await browser.page.getByRole('button', { name: 'Approve selected' }).click();
			await browser.page.waitForURL(/status=APPROVE/);
			assert.equal(await browser.page.locator('details').filter({ hasText: 'Full transcript' }).getAttribute('open'), null);
			assert.equal(await browser.page.getByText('Selected updates saved.').count(), 1);
		} else {
			const fields = { selected: key, decision: 'APPROVE' };
			const query = '&candidate=' + candidate;
			const result = await redirectTo(action('decide', id, fields, query));
			assert.equal(result.searchParams.get('status'), 'APPROVE');
			assert.equal(String(await redirectTo(action('decide', id, fields, query))), String(result));
		}
	}
	try {
		process.env.APP_ORIGIN_DEV = origin;
		if (process.env.RELISH_BROWSER_LU_TEST === 'YES') {
			browser = await reviewBrowser(vite, route, owner);
			origin = browser.origin;
		}
		delete process.env.RELISH_FOUNDATION_LU_REVIEW;
		const initial = await route.load(event(first));
		const firstFields = { sourceVersion: '1', requestKey: initial.requestKey };
		assert.equal(initial.enabled, false);
		await assert.rejects(action('assessConversation', first, firstFields), status(404));
		await assert.rejects(assess(first, 'initial'), /unavailable/);
		assert.equal(calls.length, 0);
		process.env.RELISH_FOUNDATION_LU_REVIEW = 'YES';
		await assert.rejects(route.load(event(first, '', { ...owner, user: { id: 'stranger', role: 'owner' } })), status(404));
		await assert.rejects(route.load(event(first, '', { ...owner, env: 'prod' })), status(404));
		await assert.rejects(route.load(event(first, '', { ...owner, user: { id: 'other', role: 'member' } })), status(404));
		await assert.rejects(route.load(event(first, '', owner, { id: otherPersonId, noteId: first })), status(404));
		await assert.rejects(action('assessConversation', first, firstFields, '', owner, 'https://example.test'), status(403));

		const nativeTimeout = AbortSignal.timeout;
		const budgets = [];
		const overall = new AbortController();
		let failed;
		try {
			AbortSignal.timeout = (milliseconds) => {
				budgets.push(milliseconds);
				return milliseconds === 240_000 ? overall.signal : nativeTimeout(milliseconds);
			};
			beforeResponse = async (stage, signal) => {
				if (stage === 'compose') {
					beforeResponse = undefined;
					overall.abort(new DOMException('Synthetic assessment deadline', 'TimeoutError'));
					assert.equal(signal.reason, overall.signal.reason);
					signal.throwIfAborted();
				}
			};
			failed = await action('assessConversation', first, firstFields);
		} finally {
			AbortSignal.timeout = nativeTimeout;
			beforeResponse = undefined;
		}
		assert.deepEqual(budgets.filter((ms) => [240_000, 90_000, 45_000].includes(ms)), [240_000, 90_000, 45_000]);
		assert.equal(failed.status, 503);
		assert.match(failed.data.message, /Analysis took too long/);
		assert.equal(failed.data.retryKey, firstFields.requestKey);
		assert.equal(await count('FoundationLuCandidate'), 0);
		assert.equal(await count('FoundationLuRevision'), 0);
		assert.equal((await route.load(event(first))).conversation.summary, 'First private summary');
		assert.equal((await action('assessConversation', first, firstFields)).status, 409);
		const warn = console.warn;
		const diagnostics = [];
		rejectAssessment = true;
		try {
			console.warn = (message) => diagnostics.push(JSON.parse(message));
			const invalid = await action('assessConversation', first, { ...firstFields, sourceVersion: '2' });
			assert.equal(invalid.status, 422);
			assert.equal(invalid.data.retryKey, firstFields.requestKey);
			assert.equal(diagnostics.length, 1);
			const { reference } = diagnostics[0];
			assert.match(reference, /^[a-f0-9-]{36}$/);
			assert.ok(invalid.data.message.endsWith(reference));
			const { stages, audits, repairs, durationMs, ...logFields } = diagnostics[0];
			assert.ok(durationMs >= 0);
			assert.deepEqual(logFields, {
				component: 'relish.lu.review', operation: 'analyse', reference,
				outcome: 'FAILED', model: 'synthetic-lu-model', promptVersion: 'foundation-lu-2026-11-v5',
				stage: 'audit', attempt: 2, reason: 'MISATTRIBUTION'
			});
			assert.deepEqual(stages.map(({ durationMs: ms, ...stage }) => {
				assert.ok(ms >= 0);
				return stage;
			}), [1, 2].flatMap((attempt) => ['decompose', 'compose', 'audit']
				.map((stage) => ({ stage, attempt, outcome: 'COMPLETED' }))));
			assert.deepEqual(audits, [1, 2].map((attempt) => ({
				attempt, issues: ['MISATTRIBUTION'], attributionIssues: ['ONE_SIDED_AS_SHARED']
			})));
			assert.deepEqual(repairs, [{ stage: 'audit', reason: 'MISATTRIBUTION' }]);
			const finding = invalid.data.reviewFindings[0];
			assert.equal(finding.claim, 'Prefers mornings for regular catch-ups.');
			assert.equal(finding.evidence[0].speaker, 'AGENT');
			assert.ok(finding.evidence.some((item) => item.speaker === 'OWNER' && item.role === 'SUPPORTS'));
			assert.equal(JSON.stringify(diagnostics).includes(finding.claim), false);
			const retry = calls.at(-3).data.attributionRepair;
			assert.deepEqual(retry, [{ issue: 'ONE_SIDED_AS_SHARED', claim: finding.claim, turnIds: ['T1', 'T2'] }]);
			if (browser) {
				await browser.page.goto(origin + pathname(first) + '?conversation=1');
				await browser.page.getByRole('button', { name: 'Analyse conversation' }).click();
				await browser.page.getByText('Why these suggestions were held', { exact: true }).click();
				assert.equal(await browser.page.getByText(finding.claim, { exact: true }).count(), 1);
				assert.ok(await browser.page.getByText('Dorian · context · Turn T1', { exact: true }).count());
			}
		} finally {
			console.warn = warn;
			rejectAssessment = false;
		}
		assert.equal(await count('FoundationLuCandidate'), 0);
		assert.equal(await count('FoundationLuRevision'), 0);
		const retried = await redirectTo(action('assessConversation', first, { ...firstFields, sourceVersion: '2' }));
		const ready = retried.searchParams.get('candidate');
		const query = '&candidate=' + ready;
		const initialReview = await route.load(event(first, query));
		assert.deepEqual(initialReview.candidate.groups.map((group) => group.group), ['self', 'person', 'relationship']);
		const initialTopic = initialReview.candidate.groups[0].topics[0];
		assert.equal(initialTopic.prose, 'Prefers mornings for regular catch-ups.');
		assert.equal(initialTopic.meanings[0].evidence[0].role, 'CONTEXT');
		assert.equal((await route.load(event(next, query))).candidate, null);
		assert.equal((await action('decide', next, { selected: initialTopic.key, decision: 'APPROVE' }, query)).status, 409);
		assert.equal(await count('FoundationLuRevision'), 0);
		const input = await lu.prepareLuAssessment(prepare, personId, first);
		const original = await lu.resumeLuAssessment(store, personId, input, firstFields.requestKey);
		assert.equal(original.provenance.invocations.length, 3);
		assert.ok(original.provenance.invocations.every((inv) => inv.model === 'synthetic-lu-model'));
		assert.equal(original.candidate.meanings[0].generation.invocationId, original.provenance.invocations[0].invocationId);
		const editFields = { topic: initialTopic.key, prose: 'Morning catch-ups suit me best.' };
		rejectEdit = true;
		const invalidEdit = await action('editProposal', first, editFields, query);
		assert.equal(invalidEdit.status, 422);
		assert.equal(invalidEdit.data.draft.prose, editFields.prose);
		rejectEdit = false;
		let edited;
		if (browser) {
			await browser.page.goto(origin + pathname(first) + '?conversation=1' + query);
			const catchUpTopic = browser.page.locator('article').filter({
				has: browser.page.getByRole('heading', { name: 'Catch-up time', exact: true })
			});
			await catchUpTopic.getByText('Edit wording', { exact: true }).click();
			await catchUpTopic.getByRole('textbox', { name: 'Paragraph' }).fill(editFields.prose);
			await catchUpTopic.getByRole('button', { name: 'Validate edit' }).click();
			await browser.page.waitForURL((url) => url.searchParams.has('candidate') && url.searchParams.get('candidate') !== ready);
			edited = new URL(browser.page.url()).searchParams.get('candidate');
		} else {
			const result = await redirectTo(action('editProposal', first, editFields, query));
			edited = result.searchParams.get('candidate');
			const beforeReplay = calls.length;
			assert.equal(String(await redirectTo(action('editProposal', first, editFields, query))), String(result));
			assert.equal(calls.length, beforeReplay);
		}
		const editedReview = await route.load(event(first, '&candidate=' + edited));
		assert.equal(editedReview.candidate.groups[0].topics[0].ownerEdited, true);
		assert.equal(editedReview.candidate.groups[0].topics[0].prose, editFields.prose);
		await approveTopic(first, edited, initialTopic.key);
		const destination = input.packet.destinations[0];
		assert.equal((await route.load(event(first))).history.length, 1);
		const v1 = await lu.readLuRevision(read, destination);
		assert.equal(v1.topics[0].effect, 'NEW');
		assert.equal(v1.topics[0].ownerEdited, true);
		assert.equal(v1.topics[0].prose, editFields.prose);
		phase = 'followup';
		const followup = await analyse(next, { browserFlow: true });
		const nextTopic = (await route.load(event(next, '&candidate=' + followup))).candidate.groups[0].topics[0];
		assert.equal(nextTopic.before, editFields.prose);
		await approveTopic(next, followup, nextTopic.key);
		const v2 = await lu.readLuRevision(read, destination);
		assert.equal(v2.revisionNumber, 2);
		assert.equal(v2.topics[0].effect, 'QUALIFIED');
		assert.equal(v2.topics[0].meaningVersionIds[0], v1.topics[0].meaningVersionIds[0]);
		assert.deepEqual(await lu.readLuRevision(read, destination, 1), v1);
		const historic = await route.load(event(next, '&group=self&revision=1&topic=' + v1.topics[0].topicId +
			'&evidence=' + v1.topics[0].versionId));
		assert.equal(historic.history[0].revision, 1);
		const quotes = historic.history[0].topics[0].evidence;
		assert.ok(quotes.some((quote) => quote.speaker === 'AGENT' && quote.role === 'CONTEXT'));
		assert.ok(quotes.some((quote) => quote.speaker === 'OWNER' && quote.link.includes(first) && quote.quote === 'Yes, mornings are best for me.'));
		if (browser) {
			await browser.page.getByRole('link', { name: 'Earlier wording' }).click();
			assert.equal(await browser.page.getByText(editFields.prose, { exact: true }).count(), 1);
			await browser.page.getByRole('link', { name: 'View evidence' }).click();
			assert.ok(await browser.page.getByRole('link', { name: 'Open source transcript' }).count());
		}
		delete process.env.RELISH_FOUNDATION_LU_REVIEW;
		assert.equal((await route.load(event(next))).history[0].revision, 2);
		await assert.rejects(action('decide', next, { decision: 'DEFER' }, '&candidate=' + followup), status(404));
		process.env.RELISH_FOUNDATION_LU_REVIEW = 'YES';

		phase = 'quiet';
		const quietReview = await route.load(event(quiet));
		await redirectTo(action('assessConversation', quiet, { sourceVersion: '1', requestKey: quietReview.requestKey }));
		const noChange = await assess(quiet, 'quiet');
		assert.equal(noChange.outcome, 'NO_CHANGE');
		assert.deepEqual(await assess(quiet, 'quiet'), noChange);
		assert.equal(await count('FoundationLuRevision'), 2);

		phase = 'followup';
		const deferred = await analyse(next);
		assert.equal((await redirectTo(action('decide', next, { decision: 'DEFER' }, '&candidate=' + deferred))).searchParams.get('status'), 'DEFER');
		const rejected = await analyse(next);
		assert.equal((await redirectTo(action('decide', next, { decision: 'REJECT' }, '&candidate=' + rejected))).searchParams.get('status'), 'REJECT');
		assert.equal(await count('FoundationLuRevision'), 2);
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
		await browser?.close();
		globalThis.fetch = previousFetch;
		for (const key of env) {
			if (previousEnv[key] === undefined) delete process.env[key];
			else process.env[key] = previousEnv[key];
		}
	}
}
