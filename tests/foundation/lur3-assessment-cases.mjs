// Runs inside the disposable LUR-2 fixture and exercises the real model gateway
// through a synthetic transport. All repository operations use the guarded client.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

export async function runLuAssessmentCases({ db, load, vite, otherPersonId, grant, personId, conversations, lu, count }) {
	const { assessFoundationConversation } = await load('server/foundation/luAssessment');
	const route = await vite.ssrLoadModule('/src/routes/people/[id]/notes/[noteId]/review/+page.server.ts');
	const personRoute = await vite.ssrLoadModule('/src/routes/people/[id]/+page.server.ts');
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
	const env = ['DATING_REVISION_MODEL', 'OPENAI_API_KEY', 'RELISH_FOUNDATION_LU_REVIEW', 'APP_ORIGIN_DEV',
		'RELISH_FOUNDATION_DORIAN', 'RELISH_FOUNDATION_DORIAN_AGENT_ID', 'RELISH_FOUNDATION_DORIAN_TOOL_SECRET',
		'ELEVENLABS_API_KEY', 'APP_ORIGIN', 'RELISH_LEGAL_DOCUMENTS_PUBLISHED',
		'RELISH_PILOT_TERMS_VERSION', 'RELISH_PILOT_CONVERSATIONAL_TERMS'];
	const previousEnv = Object.fromEntries(env.map((key) => [key, process.env[key]]));
	let phase = 'initial';
	let beforeResponse;
	let rejectEdit = false;
	let rejectAssessment = false;
	let mismatchQuote = false;
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
		const stage = data.topic ? (data.neighbours ? 'focused-compose' : 'edit-audit')
			: data.draft ? 'audit' : data.decomposition ? 'compose' : 'decompose';
		calls.push({ stage, data });
		if (beforeResponse) await beforeResponse(stage, init.signal);
		let output;
		if (data.targetSpeaker === 'OWNER' && data.source) {
            // Topic-first discovery sees the full transcript and only the self inventory.
            const existing = data.prior.find(p => p.title === 'Catch-up time');
            // Replay a plausible invalid follow-up reference before returning the exact permitted ID.
            const topicRef = existing && !data.correction ? 'invented-saved-topic' : existing?.existingTopicId ?? '';
            output = { areas: [{ existingTopicId: topicRef, suggestedRealm: 'Friendships',
                suggestedTopic: 'Catch-up time', impact: 'SIGNIFICANT', reason: "The owner's preferred timing for social contact.", relevantTurnIds: [data.source.turns.find(t=>t.role==='OWNER').id] }],
                exclusions: data.source.turns.filter(t=>t.role==='OWNER').slice(1).map(t=>({turnId:t.id,reason:'NO_DURABLE_MEANING'})), unresolvedMentions: [] };
            if (data.prior.length) output.topicEffects = data.prior.map(p => ({
                existingTopicId: p.existingTopicId, effect: p === existing ? 'QUALIFIED' : 'UNCHANGED',
                reason: 'The source qualifies the timing preference.',
                relevantTurnIds: p === existing ? output.areas[0].relevantTurnIds : []
            }));
        } else if (data.area) {
            const ownerTurn = data.turns.find(turn => turn.role === 'OWNER');
            const exactQuote = data.prior ? 'Only on weekends now.' : 'Mornings are best for me.';
            output = { prose: data.prior && data.auditRepair ? 'Prefers morning catch-ups on weekends.' :
                    data.prior ? 'Prefers all catch-ups on weekends.' : 'Prefers mornings for regular catch-ups.',
                effect: data.prior ? 'QUALIFIED' : 'NEW', timeScope: 'CURRENT', retire: [], meanings: [{
                    text: exactQuote, kind: 'PREFERENCE', basis: 'DIRECT_ACCOUNT',
                    uncertainty: null, confidence: 'HIGH', evidence: [{turnId:ownerTurn.id,quote:exactQuote,role:'SUPPORTS'}]
                }] };
            if (data.auditRepair?.findings.some((finding) => finding.newFinding)) {
                output.prose = 'Now prefers morning catch-ups on weekends.';
            }
            if (data.auditRepair) {
                // Simulate a saved-topic rewrite returning fields that previously caused TOPIC_TARGET.
                output.title = 'A replacement title';
                output.effect = 'NEW';
                output.timeScope = 'HISTORICAL';
                output.retire = [{ meaning: 'foreign-meaning', reason: 'Do not apply.' }];
            }
        } else if (data.areas) {
            // Make the follow-up reject the first draft and verify the revised complete draft.
            const changed = data.draft.find(topic => topic.topicRef === 'A1');
            output = phase === 'dorian-held'
                ? { issues: ['UNSUPPORTED_PROSE', 'OMITTED_MEANING'],
                    findings: ['Gendered wording is unsupported.', 'The rewrite omitted the supported timing detail.'],
                    topicRepairs: [
                        { issue: 'UNSUPPORTED_PROSE', editTopics: ['A1'], instruction: 'Remove unsupported gendered wording.' },
                        { issue: 'OMITTED_MEANING', editTopics: ['A1'], instruction: 'Retain the supported timing detail.' }
                    ] }
                : phase === 'dorian-auto-follow-up' && changed?.prose === 'Prefers morning catch-ups on weekends.'
                ? { issues: ['OMITTED_MEANING'], findings: ['The owner expresses a current change.'],
                    topicRepairs: [{ issue: 'OMITTED_MEANING', editTopics: ['A1'], instruction: 'Preserve “now” from the owner’s source turn T2.', newFinding: true }] }
                : changed?.prose === 'Prefers all catch-ups on weekends.'
                ? { issues: ['UNSUPPORTED_PROSE'], findings: ['The wording overstates the timing preference.'],
                    topicRepairs: [{issue:'UNSUPPORTED_PROSE', editTopics:['A1'], instruction:'Keep the prior morning preference and qualify it with weekends.'}] }
                : { issues: [], findings: [] };
        } else if (stage === 'decompose') {
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
										{ turnId: answer.id, quote: mismatchQuote ? 'Mornings suit me.' : null, role: 'SUPPORTS' }
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
		} else if (stage === 'focused-compose') {
			output = { prose: data.meanings[0].text };
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
		await assert.rejects(action('compareWriting', first, firstFields), status(404));
		await assert.rejects(action('assessConversation', first, firstFields), status(404));
		await assert.rejects(assess(first, 'initial'), /unavailable/);
		assert.equal(calls.length, 0);
		process.env.RELISH_FOUNDATION_LU_REVIEW = 'YES';
		await assert.rejects(route.load(event(first, '', { ...owner, user: { id: 'stranger', role: 'owner' } })), status(404));
		await assert.rejects(route.load(event(first, '', { ...owner, env: 'prod' })), status(404));
		await assert.rejects(route.load(event(first, '', { ...owner, user: { id: 'other', role: 'member' } })), status(404));
		await assert.rejects(route.load(event(first, '', owner, { id: otherPersonId, noteId: first })), status(404));
		await assert.rejects(action('assessConversation', first, firstFields, '', owner, 'https://example.test'), status(403));
		await assert.rejects(action('compareWriting', first, firstFields, '', owner, 'https://example.test'), status(403));

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
		assert.equal(await count('FoundationLuCandidate'), 1);
		const recoveredTimeout = await route.load(event(first));
		assert.equal(recoveredTimeout.candidate, null);
		assert.equal(recoveredTimeout.failedReview.reason, 'MODEL_TIMEOUT');
		assert.equal(recoveredTimeout.failedReview.message, failed.data.message);
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
				outcome: 'FAILED', model: 'synthetic-lu-model', promptVersion: 'foundation-lu-2026-11-v7',
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
			const reopened = await route.load(event(first));
			assert.equal(reopened.candidate, null);
			assert.equal(reopened.failedReview.reference, reference);
			assert.deepEqual(reopened.failedReview.stageReview, JSON.parse(JSON.stringify(invalid.data.stageReview)));
			assert.equal((await route.load(event(first, '&candidate=' + reference))).candidate, null);
			assert.equal((await action('decide', first, { decision: 'REJECT' }, '&candidate=' + reference)).status, 409);
			const panels = invalid.data.stageReview;
			assert.deepEqual(panels.map(({ stage, attempt, reason }) => [stage, attempt, reason]), [
				['decompose', 1, undefined], ['compose', 1, undefined], ['audit', 1, undefined],
				['audit', 1, 'MISATTRIBUTION'],
				['decompose', 2, undefined], ['compose', 2, undefined], ['audit', 2, undefined],
				['audit', 2, 'MISATTRIBUTION']
			]);
			assert.ok(panels[0].items[0].text.includes('Whole turn'));
			assert.ok(panels[1].items[0].text.includes('Primary meanings: M1'));
			assert.equal(JSON.stringify(diagnostics).includes('stageReview'), false);
			const finding = invalid.data.reviewFindings[0];
			assert.equal(finding.claim, 'Prefers mornings for regular catch-ups.');
			assert.equal(finding.evidence[0].speaker, 'AGENT');
			assert.ok(finding.evidence.some((item) => item.speaker === 'OWNER' && item.role === 'SUPPORTS'));
			assert.equal(JSON.stringify(diagnostics).includes(finding.claim), false);
			const retry = calls.at(-3).data.attributionRepair;
			assert.deepEqual(retry, [{ issue: 'ONE_SIDED_AS_SHARED', claim: finding.claim, turnIds: ['T1', 'T2'] }]);
			if (browser) {
				await browser.page.goto(origin + pathname(first) + '?conversation=1');
				// Open a clean GET, with no action response available to the page.
				await browser.page.getByText('Analysis steps', { exact: true }).click();
				await browser.page.getByText('Extraction · Attempt 1', { exact: true }).click();
				assert.ok(await browser.page.getByRole('button', { name: 'Copy item' }).first().isVisible());
				await browser.page.getByText('Why these suggestions were held', { exact: true }).click();
				assert.equal(await browser.page.getByText(finding.claim, { exact: true }).count(), 1);
				assert.ok(await browser.page.getByText('Dorian · context · Turn T1', { exact: true }).count());
			}
		} finally {
			console.warn = warn;
			rejectAssessment = false;
		}
		assert.equal(await count('FoundationLuCandidate'), 2);
		assert.equal(await count('FoundationLuRevision'), 0);
		mismatchQuote = true;
		const retried = await redirectTo(action('assessConversation', first, { ...firstFields, sourceVersion: '2' }));
		mismatchQuote = false;
		const ready = retried.searchParams.get('candidate');
		const query = '&candidate=' + ready;
		assert.equal((await route.load(event(first))).failedReview, null);
		const initialReview = await route.load(event(first, query));
		assert.deepEqual(initialReview.candidate.stageReview.map(({ stage, reason }) => [stage, reason]), [
			['decompose', undefined], ['decompose', 'REPAIRED_CITATIONS'], ['compose', undefined], ['audit', undefined]
		]);
		assert.ok(initialReview.candidate.stageReview[0].items.some(({ title }) => title.includes('My view of our relationship')));
		assert.deepEqual(initialReview.candidate.groups.map((group) => group.group), ['self', 'person', 'relationship']);
		const initialTopic = initialReview.candidate.groups[0].topics[0];
		assert.equal(initialTopic.prose, 'Prefers mornings for regular catch-ups.');
		assert.equal(initialTopic.meanings[0].evidence[0].role, 'CONTEXT');
		assert.equal(initialTopic.meanings[0].evidence[1].quote, 'Yes, mornings are best for me.');
		assert.equal((await route.load(event(next, query))).candidate, null);
		assert.equal((await action('decide', next, { selected: initialTopic.key, decision: 'APPROVE' }, query)).status, 409);
		assert.equal(await count('FoundationLuRevision'), 0);
		const input = await lu.prepareLuAssessment(prepare, personId, first);
		const original = await lu.resumeLuAssessment(store, personId, input, firstFields.requestKey);
		assert.equal(original.provenance.invocations.length, 3);
		assert.deepEqual(original.provenance.repairs, [{ stage: 'decompose', reason: 'INVALID_QUOTE' }]);
		assert.ok(original.provenance.invocations.every((inv) => inv.model === 'synthetic-lu-model'));
		assert.equal(original.candidate.meanings[0].generation.invocationId, original.provenance.invocations[0].invocationId);
		const beforeComparison = calls.length;
		const beforeCandidates = await count('FoundationLuCandidate');
		if (browser) {
			await browser.page.goto(origin + pathname(first) + '?conversation=1' + query);
			await browser.page.getByText('Compare writing approaches', { exact: true }).first().click();
			await browser.page.getByRole('button', { name: 'Compare writing approaches' }).click();
			await browser.page.getByText('One topic at a time', { exact: true }).first().waitFor();
			assert.equal(await browser.page.getByText('Audit passed.', { exact: true }).count(), 2);
		} else {
			const result = await action('compareWriting', first, { sourceVersion: '2' }, query);
			assert.equal(result.comparisonSourceVersion, 2);
			assert.equal(result.comparison.topics.length, 3);
			assert.equal(result.comparison.topics[0].together, initialTopic.prose);
			assert.equal(result.comparison.topics[0].focused, 'Yes, mornings are best for me.');
			assert.deepEqual(result.comparison.together.issues, []);
			assert.deepEqual(result.comparison.focused.issues, []);
		}
		assert.deepEqual(calls.slice(beforeComparison).map(({ stage }) => stage),
			['decompose', 'compose', 'audit', 'focused-compose', 'focused-compose', 'focused-compose', 'audit']);
		assert.equal(await count('FoundationLuCandidate'), beforeCandidates);
		assert.equal(await count('FoundationLuRevision'), 0);
		assert.equal((await route.load(event(first, query))).candidate.id, ready);
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
        // Exercise two manual imports through the public form action and the existing review route.
        const importTranscript = (fields, locals = owner, requestOrigin = origin, id = personId) => {
            const url = new URL('/people/' + id + '?/importTranscript', origin);
            return personRoute.actions.importTranscript({
                locals, params: { id }, url,
                request: new Request(url, { method: 'POST', headers: { origin: requestOrigin }, body: new URLSearchParams(fields) })
            });
        };
        const firstOwnerTurn = 'Mornings are best for me. Thanks for asking about the catch-ups. We still have time to settle the arrangements next week.';
        const firstFieldsForImport = { importId: randomUUID(), summary: 'Catch-up preferences', utcTime: '2026-11-12T03:00',
            transcript: 'Context: What time works for you?\nYou: ' + firstOwnerTurn };
        await assert.rejects(importTranscript(firstFieldsForImport, owner, 'https://wrong.example'), status(403));
        await assert.rejects(importTranscript(firstFieldsForImport, { ...owner, env: 'prod' }), status(404));
        await assert.rejects(importTranscript(firstFieldsForImport, { ...owner, user: { ...owner.user, role: 'member' } }), status(404));
        await assert.rejects(importTranscript(firstFieldsForImport, owner, origin, otherPersonId), status(404));
        assert.equal((await importTranscript({ ...firstFieldsForImport, transcript: 'Mystery: Mornings are best for me.' })).status, 400);
        assert.equal((await importTranscript({ ...firstFieldsForImport, transcript: 'Context: What time works for you?' })).status, 400);

        let importedFirst;
        let importedV1;
        for (let round = 0; round < 2; round++) {
            const submitted = round
                ? { importId: randomUUID(), summary: 'Weekend follow-up', utcTime: '2026-11-13T03:00', transcript: 'You: Only on weekends now.' }
                : firstFieldsForImport;
            const callsBeforeImport = calls.length;
            const imported = await redirectTo(importTranscript(submitted));
            assert.equal(String(await redirectTo(importTranscript(submitted))), String(imported));
            assert.equal((await importTranscript({ ...submitted, transcript: 'You: A different transcript.' })).status, 409);
            assert.equal(calls.length, callsBeforeImport);
            assert.match(imported.pathname, /\/notes\/[0-9a-f-]+\/review$/);
            const source = imported.pathname.split('/').at(-2);
            if (!round) importedFirst = source;
            const stored = await conversations.readPersonConversation(await grant('READ_CONVERSATION', 'other'), personId, source);
            assert.equal(stored.imported, true);
            assert.equal(stored.sourceVersion, 1);
            assert.equal(stored.turns.at(-1).role, 'OWNER');
            assert.equal(stored.turns.at(-1).text, round ? 'Only on weekends now.' : firstOwnerTurn);
            if (!round) assert.equal(stored.turns[0].role, 'UNRESOLVED');
            const initialSelf = await route.load(event(source));
            const fields = { method: 'SELF_TOPICS', sourceVersion: String(initialSelf.conversation.sourceVersion), requestKey: initialSelf.requestKey };
            const location = await redirectTo(action('assessConversation', source, fields));
            const candidateId = location.searchParams.get('candidate');
            const reviewed = await route.load(event(source, '&candidate=' + candidateId));
            assert.deepEqual(reviewed.candidate.groups.map(g=>g.group), ['self']);
            assert.ok(reviewed.candidate.stageReview.some(panel =>
                panel.items.some(item => item.title === 'Area of understanding: Catch-up time')));
            if (round) assert.ok(reviewed.candidate.stageReview.some(panel =>
                panel.stage === 'decompose' && panel.reason === 'DISCOVERY_UNKNOWN_TOPIC'));
            const oldCalls = calls.length;
            fields.sourceVersion = String(reviewed.conversation.sourceVersion);
            assert.equal(String(await redirectTo(action('assessConversation', source, fields))), String(location));
            assert.equal(calls.length, oldCalls);
            const topic = reviewed.candidate.groups[0].topics[0];
            assert.equal(topic.effect, round ? 'QUALIFIED' : 'NEW');
            assert.equal(reviewed.candidate.sourceVersion, reviewed.conversation.sourceVersion);
            assert.equal(topic.meanings[0].evidence[0].turnId, stored.turns.at(-1).id);
            assert.equal(topic.meanings[0].evidence[0].quote, round ? 'Only on weekends now.' : 'Mornings are best for me.');
            if (browser && !round) {
                await browser.page.goto(location.href);
                await browser.page.getByText('Supporting evidence', { exact: true }).click();
                const quote = browser.page.locator('blockquote').getByText('Mornings are best for me.', { exact: true });
                const fullTurn = browser.page.locator('blockquote').getByText(firstOwnerTurn, { exact: true });
                assert.equal(await quote.isVisible(), true);
                assert.equal(await fullTurn.isVisible(), false);
                await browser.page.getByText('Read full source turn', { exact: true }).click();
                assert.equal(await fullTurn.isVisible(), true);
            }
            if (round) {
                assert.equal(topic.prose, 'Prefers morning catch-ups on weekends.');
                assert.equal(topic.title, 'Catch-up time');
                assert.equal(topic.timeScope, 'CURRENT');
                assert.equal(topic.before, importedV1.topics[0].prose);
                assert.deepEqual(await lu.readLuRevision(read, destination), importedV1);
                assert.ok(reviewed.candidate.stageReview.some(panel => panel.stage === 'audit' && panel.attempt === 2));
            }
            await redirectTo(action('decide', source, {decision:'APPROVE',selected:topic.key}, '&candidate='+candidateId));
            const history = (await route.load(event(source))).history;
            assert.ok(history.some(h=>h.group==='self'));
            const snapshot = await lu.readLuRevision(read, destination);
            if (!round) {
                importedV1 = snapshot;
            } else {
                const currentTopic = snapshot.topics.find(item => item.topicId === importedV1.topics[0].topicId);
                assert.ok(currentTopic);
                assert.equal(snapshot.revisionNumber, importedV1.revisionNumber + 1);
                assert.deepEqual(await lu.readLuRevision(read, destination, importedV1.revisionNumber), importedV1);
                const evidence = await route.load(event(source, '&group=self&topic=' + currentTopic.topicId + '&evidence=' + currentTopic.versionId));
                const quotes = evidence.history[0].topics[0].evidence;
                assert.ok(quotes.some(quote => quote.link.includes(importedFirst) && quote.quote === 'Mornings are best for me.'));
                assert.ok(quotes.some(quote => quote.link.includes(source) && quote.quote === 'Only on weekends now.'));
            }
        }

		// Exercise the participant launch, durable worker, operator approval and private next-call tool.
		process.env.RELISH_FOUNDATION_DORIAN = 'YES';
		process.env.RELISH_FOUNDATION_DORIAN_AGENT_ID = 'synthetic-agent';
		process.env.RELISH_FOUNDATION_DORIAN_TOOL_SECRET = 'synthetic-tool-secret';
		process.env.ELEVENLABS_API_KEY = 'synthetic-elevenlabs-key';
		// The Chromium fixture serves HTTP on localhost. The current published
		// legal policy still uses the deployment's canonical HTTPS origin.
		const policyOrigin = 'https://dev.relish.live';
		process.env.APP_ORIGIN = policyOrigin;
		process.env.RELISH_LEGAL_DOCUMENTS_PUBLISHED = 'YES';
		process.env.RELISH_PILOT_TERMS_VERSION = 'fixture-v1';
		process.env.RELISH_PILOT_CONVERSATIONAL_TERMS = 'YES';
		const callRoute = await vite.ssrLoadModule('/src/routes/dorian/+page.server.ts');
		const { policyInstructionForCaller } = await load('server/core/relishCallPolicy');
		const operator = await vite.ssrLoadModule('/src/routes/operator/dorian-foundation/[id]/+page.server.ts');
		const tool = await vite.ssrLoadModule('/src/routes/api/webhooks/elevenlabs/tools/foundation-memory/+server.ts');
		const { processDorianFoundationCall } = await load('server/foundation/dorianCalls');
		const participant = { ...owner, sessionId: 'participant-browser-session', user: { id: 'stranger', role: 'member' } };
		const launchUrl = new URL('/dorian', origin);
		async function launch(number, locals = participant, consent = '', policyVersion = 'fixture-v1', requestOrigin = origin) {
			const conversationId = 'conv_pilot_' + number;
			const response = await callRoute.actions.start({ locals, url: launchUrl, setHeaders() {},
				request: new Request(launchUrl, { method: 'POST', headers: { origin: requestOrigin },
					body: new URLSearchParams({ consent, policyVersion }) }),
				fetch: async () => Response.json({ token: 'synthetic-call-token', conversation_id: conversationId })
			});
			return { conversationId, response };
		}
		async function memory(conversationId, secret = 'synthetic-tool-secret') {
			const url = new URL('/api/webhooks/elevenlabs/tools/foundation-memory', origin);
			return tool.POST({ url, locals: { env: 'dev' }, request: new Request(url, {
				method: 'POST', headers: { authorization: 'Bearer ' + secret }, body: JSON.stringify({ conversation_id: conversationId })
			}) });
		}
		assert.equal((await launch('missing-consent', participant, '')).response.status, 400);
		assert.equal((await launch('stale-consent', participant, '1', 'fixture-v0')).response.status, 400);
		const termsState = locals => callRoute.load({ locals, url: launchUrl, setHeaders() {} });
		assert.equal((await termsState(participant)).accepted, false);
		// Seed the exact record made by the voice acceptance tool for a separate account.
		await db.query(`INSERT INTO "RelishCallPolicyAcceptance"
			(id, "userId", "policyVersion", "termsUrl", "privacyUrl", "sessionId", "conversationId", method)
			VALUES ('voice-fixture', $1, 'fixture-v1', $2, $3, 'phone-fixture', 'conv_phone_fixture', 'VOICE_EXPLICIT')`,
			[owner.user.id, policyOrigin + '/legal/terms', policyOrigin + '/legal/privacy']);
		assert.equal((await termsState(owner)).accepted, true);
		assert.equal((await termsState(participant)).accepted, false);
		for (const round of [1, 2]) {
			const { conversationId, response } = round === 1
				? await launch(round, participant, '1')
				: await launch(round, { ...participant, sessionId: 'later-browser-session' });
			assert.equal((await termsState(participant)).accepted, true);
			assert.equal((await policyInstructionForCaller(participant.user.id)).accepted, true);
			assert.equal((await db.query('SELECT method FROM "RelishCallPolicyAcceptance" WHERE "userId"=$1',
				[participant.user.id])).rows[0].method, 'BROWSER_EXPLICIT');
			assert.deepEqual(Object.keys(response).sort(), ['reference', 'token']);
			const before = (await (await memory(conversationId)).json()).topics;
			assert.equal(before.length, round - 1);
			assert.equal((await memory(conversationId, 'wrong-secret')).status, 401);
			assert.deepEqual((await (await memory('conv_nonexistent')).json()).topics, []);
			await db.query('UPDATE "DorianFoundationCall" SET "nextAttemptAt"=CURRENT_TIMESTAMP WHERE "conversationId"=$1', [conversationId]);
			const quote = round === 1 ? 'Mornings are best for me.' : 'Only on weekends now.';
			assert.equal(await processDorianFoundationCall(async () => ({
				conversation_id: conversationId, agent_id: 'synthetic-agent', status: 'done',
				transcript: [{ role: 'agent', message: 'When do you like to catch up?' }, { role: 'user', message: quote }]
			})), true);
			const row = (await db.query('SELECT * FROM "DorianFoundationCall" WHERE "conversationId"=$1', [conversationId])).rows[0];
			assert.equal(row.state, 'READY');
			assert.deepEqual((await (await memory(conversationId)).json()).topics, before);
			const url = new URL('/operator/dorian-foundation/' + row.id + '?candidate=' + row.candidateId, origin);
			const input = { locals: owner, params: { id: row.id }, url, setHeaders() {} };
			await assert.rejects(operator.load({ ...input, locals: participant }), status(404));
			await assert.rejects(conversations.readPersonConversation(await grant('READ_CONVERSATION', 'stranger'),
				row.subjectId, row.sourceId), /unavailable/);
			const reviewed = await operator.load(input);
			assert.deepEqual(reviewed.candidate.groups.map(group => group.group), ['self']);
			assert.equal(reviewed.history[0]?.revision ?? 0, round - 1);
			const topic = reviewed.candidate.groups[0].topics[0];
			assert.equal(topic.meanings[0].evidence[0].quote, quote);
			if (round === 2) assert.ok(reviewed.candidate.stageReview.some(panel => panel.stage === 'audit' && panel.attempt === 2));
			await redirectTo(operator.actions.decide({ ...input, request: new Request(url, {
				method: 'POST', headers: { origin }, body: new URLSearchParams({ decision: 'APPROVE', selected: topic.key })
			}) }));
			const approved = await operator.load(input);
			assert.equal(approved.history[0].revision, round);
			assert.equal((await (await memory(conversationId)).json()).topics.length, 1);
			if (round === 2) {
				const current = approved.history[0].topics[0];
				url.searchParams.set('evidence', current.versionId);
				const result = await operator.load(input);
				assert.ok(result.history[0].topics[0].evidence.some(item => item.quote === 'Mornings are best for me.'));
				assert.ok(result.history[0].topics[0].evidence.some(item => item.quote === quote));
			}
		}
		process.env.RELISH_PILOT_TERMS_VERSION = 'fixture-v2';
		assert.equal((await termsState(participant)).accepted, false);
		assert.equal((await policyInstructionForCaller(participant.user.id)).accepted, false);
		assert.equal((await launch('changed-policy')).response.status, 400);
		process.env.RELISH_PILOT_TERMS_VERSION = 'fixture-v1';
		await assert.rejects(launch('cross-origin', participant, '', 'fixture-v1', 'https://example.com'), status(403));
		const separateCall = await launch(3, owner);
		assert.equal(separateCall.response.token, 'synthetic-call-token');
		assert.deepEqual((await (await memory(separateCall.conversationId)).json()).topics, []);

		// Replay the two v6 audit findings after a repair and keep the approved revision live.
		phase = 'dorian-held';
		const heldCall = await launch(4);
		await db.query('UPDATE "DorianFoundationCall" SET "nextAttemptAt"=CURRENT_TIMESTAMP WHERE "conversationId"=$1',
			[heldCall.conversationId]);
		await processDorianFoundationCall(async () => ({
			conversation_id: heldCall.conversationId, agent_id: 'synthetic-agent', status: 'done',
			transcript: [{ role: 'agent', message: 'When should we catch up?' }, { role: 'user', message: 'Only on weekends now.' }]
		}));
		const heldRow = (await db.query('SELECT * FROM "DorianFoundationCall" WHERE "conversationId"=$1',
			[heldCall.conversationId])).rows[0];
		assert.equal(heldRow.state, 'HELD');
		assert.equal(heldRow.candidateId, null);
		const heldUrl = new URL('/operator/dorian-foundation/' + heldRow.id, origin);
		const heldReview = await operator.load({ locals: owner, params: { id: heldRow.id }, url: heldUrl, setHeaders() {} });
		assert.ok(heldReview.failedReview.stageReview.some(panel => panel.stage === 'audit' && panel.attempt === 2));
		assert.equal(heldReview.history[0].revision, 2);
		assert.deepEqual((await (await memory(heldCall.conversationId)).json()).topics,
			[{ title: 'Catch-up time', prose: 'Prefers morning catch-ups on weekends.' }]);

		assert.equal(heldReview.failedReview.structuralCheckpoint, undefined);
		const beforeRetry = calls.length;
		await redirectTo(operator.actions.retry({
			locals: owner, params: { id: heldRow.id }, url: heldUrl,
			request: new Request(heldUrl, { method: 'POST', headers: { origin } })
		}));
		phase = 'followup';
		assert.equal(await processDorianFoundationCall(async () => {
			assert.fail('A structural retry must use the stored transcript.');
		}), true);
		const retryRow = (await db.query('SELECT state, "candidateId" FROM "DorianFoundationCall" WHERE id=$1', [heldRow.id])).rows[0];
		assert.equal(retryRow.state, 'READY');
		assert.ok(retryRow.candidateId);
		const retryCalls = calls.slice(beforeRetry);
		assert.ok(retryCalls[0].data.draft);
		assert.ok(retryCalls.every(({ data }) => data.draft || data.auditRepair));
		const resumedReview = await operator.load({ locals: owner, params: { id: heldRow.id }, url: heldUrl, setHeaders() {} });
		assert.ok(resumedReview.candidate.stageReview.some((panel) =>
			panel.items.some((item) => item.title === 'Structural review resumed')));
		assert.equal(resumedReview.history[0].revision, 2);

		// A new audit finding is repaired in the same worker run. Only approval
		// can make the repaired topic available to the next Dorian call.
		phase = 'dorian-auto-follow-up';
		const automaticCall = await launch(5);
		await db.query('UPDATE "DorianFoundationCall" SET "nextAttemptAt"=CURRENT_TIMESTAMP WHERE "conversationId"=$1',
			[automaticCall.conversationId]);
		assert.equal(await processDorianFoundationCall(async () => ({
			conversation_id: automaticCall.conversationId, agent_id: 'synthetic-agent', status: 'done',
			transcript: [{ role: 'agent', message: 'When works now?' }, { role: 'user', message: 'Only on weekends now.' }]
		})), true);
		const automaticRow = (await db.query('SELECT id, state FROM "DorianFoundationCall" WHERE "conversationId"=$1',
			[automaticCall.conversationId])).rows[0];
		assert.equal(automaticRow.state, 'READY');
		const automaticUrl = new URL('/operator/dorian-foundation/' + automaticRow.id, origin);
		const automaticReview = await operator.load({
			locals: owner, params: { id: automaticRow.id }, url: automaticUrl, setHeaders() {}
		});
		assert.ok(automaticReview.candidate.stageReview.some(panel => panel.stage === 'audit' && panel.attempt === 3));
		assert.equal(automaticReview.candidate.groups[0].topics[0].prose, 'Now prefers morning catch-ups on weekends.');
		assert.equal(automaticReview.history[0].revision, 2);


	} finally {
		await browser?.close();
		globalThis.fetch = previousFetch;
		for (const key of env) {
			if (previousEnv[key] === undefined) delete process.env[key];
			else process.env[key] = previousEnv[key];
		}
	}
}
