// Exercise the real guarded Prisma repositories with synthetic data and no provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createServer } from 'vite';
import { runLuAssessmentCases } from './lur3-assessment-cases.mjs';
import { applyLuMigration } from './lu-migration-fixture.mjs';

const endpoint = process.env.LUR2_TEST_DATABASE_URL;
function capture(id, text) {
	return {
		format: 'conversation-v1',
		binding: { provider: 'ELEVENLABS', conversationId: 'conv_' + id, agentId: 'synthetic-agent' },
		occurredAt: '2026-11-10T03:00:00Z',
		completeness: 'COMPLETE',
		turns: [
			{ id: 'T1', role: 'AGENT', text: 'What stood out to you?' },
			{ id: 'T2', role: 'OWNER', text }
		]
	};
}
function proposal(packet, freshTitle, { update = false } = {}) {
	const { subjectId, perspectiveId, revisionId, topics } = packet.baselines[0];
	const target = { subjectId, perspectiveId };
	const evidence = packet.turns.map((t) => ({
		sourceVersionId: packet.source.versionId,
		turnId: t.id,
		start: t.start,
		end: t.end,
		quote: packet.text.slice(t.start, t.end),
		role: t.speakerId === 'OWNER' ? 'SUPPORTS' : 'CONTEXT'
	}));
	const meaning = {
		...target,
		id: 'm',
		text: evidence[1].quote,
		kind: 'PREFERENCE',
		basis: 'DIRECT_ACCOUNT',
		expressedUncertainty: null,
		confidence: 'MEDIUM',
		speakerId: 'OWNER',
		asserter: { kind: 'SOURCE_SPEAKER', referenceId: 'OWNER' },
		generation: {
			kind: 'MODEL_DRAFTED',
			model: 'synthetic',
			invocationId: 'invocation',
			promptVersion: 'fixture',
			pipelineVersion: 'test'
		},
		recorder: 'SERVICE',
		review: 'UNREVIEWED',
		observedAt: packet.source.occurredAt,
		validFrom: null,
		validUntil: null,
		evidence
	};
	const drafts = topics.map((t, i) => ({
		key: 'prior-' + i,
		topicId: t.topicId,
		previousVersionId: t.versionId,
		effect: update && i === 0 ? 'REINFORCED' : 'UNCHANGED',
		area: 'Friends',
		title: 'New wording',
		prose:
			update && i === 0 ? 'Reinforced with this conversation.' : 'Must not replace prior prose.',
		timeScope: 'CURRENT',
		meaningIds: update && i === 0 ? ['m'] : [],
		retainedMeaningVersionIds: t.meaningVersionIds,
		retiredMeanings: []
	}));
	if (freshTitle)
		drafts.push({
			key: 'new',
			topicId: null,
			previousVersionId: null,
			effect: 'NEW',
			area: 'Friends',
			title: freshTitle,
			prose: meaning.text,
			timeScope: 'MIXED',
			meaningIds: ['m'],
			retainedMeaningVersionIds: [],
			retiredMeanings: []
		});
	return {
		contract: 'LUR-1',
		sourceVersionId: packet.source.versionId,
		sourceContentMac: packet.source.contentMac,
		meanings: [meaning],
		streams: [{ ...target, baselineRevisionId: revisionId, topics: drafts }],
		exclusions: []
	};
}
function selection(candidate, requestKey) {
	return {
		requestKey,
		decision: 'APPROVE',
		selected: candidate.streams.flatMap((s) =>
			s.topics
				.filter((t) => t.effect !== 'UNCHANGED')
				.map((t) => ({
					subjectId: s.subjectId,
					perspectiveId: s.perspectiveId,
					topicKey: t.key
				}))
		)
	};
}

test(
	'LUR-2 persists full sources and eligible immutable revisions',
	{ timeout: 120000 },
	async (t) => {
		let db, socket, vite, prisma;
		try {
			if (endpoint) {
				const url = new URL(endpoint);
				assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
				assert.match(url.pathname, /^\/relish_lur2_[a-z0-9_]+$/);
				assert.equal(url.search, '');
				const { Client } = await import('pg');
				const client = new Client({ connectionString: endpoint });
				await client.connect();
				db = {
					exec: (sql) => client.query(sql),
					query: (...args) => client.query(...args),
					close: () => client.end()
				};
				assert.equal(
					(await db.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'"))
						.rows[0].n,
					0
				);
			} else db = await PGlite.create();
			await db.exec(`CREATE TABLE "User" (id text PRIMARY KEY, "email_Enc" text);
			CREATE TABLE "Profile" (id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id));
			INSERT INTO "User"(id) VALUES ('owner'), ('other');`);
			for (const migration of [
				'20261104010000_f202_foundation_schema',
				'20261107010000_s402_exchange_claims',
				'20261107020000_s402b_exchange_service',
				'20261107030000_s405c_account_channels',
				'20261108010000_s405d_guest_assurance',
				'20261109060000_google_mailbox_authority'
			])
				await db.exec(await readFile('prisma/migrations/' + migration + '/migration.sql', 'utf8'));
			if (!endpoint) {
				socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 1 });
				await socket.start();
			}
			process.env.DATABASE_URL = endpoint
				? endpoint + '?connection_limit=4'
				: 'postgresql://postgres:postgres@' +
					socket.getServerConn() +
					'/postgres?connection_limit=1';
			process.env.SECRET_MASTER_KEY = 'a'.repeat(64);
			process.env.DB_KEEPALIVE_ENABLED = 'NO';
			vite = await createServer({
				configFile: false,
				server: { middlewareMode: true, hmr: false },
				resolve: { alias: { $lib: resolve('src/lib') } }
			});
			const load = (name) => vite.ssrLoadModule('/src/lib/' + name + '.ts');
			({ prisma } = await load('db'));
			const provision = await load('server/foundation/provisioning');
			const policy = await load('server/foundation/policy');
			const people = await load('server/foundation/subjects');
			const evidence = await load('server/foundation/evidence');
			const conversations = await load('server/foundation/conversations');
			const lu = await load('server/foundation/livingUnderstanding');
			const privacy = await load('server/foundation/privacyOperations');
			for (const userId of ['owner', 'other']) await provision.prepareFoundationAccount(userId);
			await db.exec(`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1`);
			const grant = (op, owner = 'owner') =>
				policy.resolveFoundationAccess({ user: { id: owner } }, op);
			const person = await people.createPerson(await grant('WRITE'), 'Synthetic person');
			const otherPerson = await people.createPerson(await grant('WRITE', 'other'), 'Other person');
			const oldNote = await evidence.appendOwnerNote(await grant('RECORD_EVIDENCE'), {
				key: 'old-note',
				expectedVersion: 0,
				text: 'Existing note',
				quote: 'Existing note',
				start: 0,
				end: 13,
				subjectIds: [person.id]
			});
			await evidence.approveNoteReview(await grant('REVIEW_NOTE'), person.id, oldNote.sourceId, 1, [
				{
					bucket: 'person',
					text: 'Previously approved observation',
					quote: 'Existing note',
					mode: 'OBSERVED'
				}
			]);
			const priorReview = await evidence.readNoteForReview(
				await grant('READ_NOTES'),
				person.id,
				oldNote.sourceId
			);
			const oldStatementId = priorReview.review.entries[0].statementId;
			const priorStatement = await evidence.readCurrentStatement(
				await grant('READ_STATEMENT'),
				oldStatementId
			);
			// Apply against data made using the prior schema, then confirm compatibility.
			await applyLuMigration(db);
			assert.equal(
				(await evidence.listPersonNotes(await grant('READ_NOTES'), person.id)).notes[0].id,
				oldNote.sourceId
			);
			assert.deepEqual(
				await evidence.readNoteForReview(await grant('READ_NOTES'), person.id, oldNote.sourceId),
				priorReview
			);
			assert.deepEqual(
				await evidence.readCurrentStatement(await grant('READ_STATEMENT'), oldStatementId),
				priorStatement
			);

			const saveAccess = await grant('SAVE_CONVERSATION');
			const readAccess = await grant('READ_CONVERSATION');
			const reviseAccess = await grant('REVISE_CONVERSATION_SOURCE');
			const prepareAccess = await grant('PREPARE_LU');
			const storeAccess = await grant('STORE_LU_CANDIDATE');
			const approveAccess = await grant('APPROVE_LU');
			const readLu = await grant('READ_LU');
			const human = { kind: 'HUMAN_AUTHORED' };
			const initial = capture('first', 'I like catching up in the mornings. 😀');
			const first = await conversations.savePersonConversation(
				saveAccess,
				person.id,
				initial,
				'Private summary',
				human
			);
			const id = first.sourceId;
			const count = async (table) =>
				(await db.query('SELECT count(*)::int n FROM "' + table + '"')).rows[0].n;
			await t.test('capture, replay and source custody', async () => {
				assert.deepEqual(
					await conversations.savePersonConversation(
						saveAccess,
						person.id,
						initial,
						'Private summary',
						human
					),
					first
				);
				assert.deepEqual(
					await conversations.savedConversationReceipt(
						saveAccess,
						person.id,
						initial.binding,
						'Private summary'
					),
					first
				);
				await assert.rejects(
					conversations.savePersonConversation(
						saveAccess,
						person.id,
						initial,
						'Different summary',
						human
					),
					/conflicts/
				);
				const saved = await conversations.readPersonConversation(readAccess, person.id, id);
				assert.deepEqual(saved.turns, initial.turns);
				assert.equal(saved.summary, 'Private summary');
				await assert.rejects(
					conversations.readPersonConversation(
						await grant('READ_CONVERSATION', 'other'),
						otherPerson.id,
						id
					),
					/unavailable/
				);
				await assert.rejects(
					conversations.readPersonConversation({ ...readAccess }, person.id, id),
					/unavailable/
				);
				await assert.rejects(lu.prepareLuInput(prepareAccess, person.id, id), /unavailable/);
				await assert.rejects(
					policy.withFoundationAccess(await grant('READ_SEGMENT'), 'READ_SEGMENT', (tx) =>
						tx.foundationSourceVersion.findFirst({ select: { payloadEnc: true } })
					),
					/unavailable/
				);
			});

			await conversations.reviseConversationSource(
				reviseAccess,
				person.id,
				id,
				1,
				'PRIVATE_ANALYSIS'
			);
			const packet = await lu.prepareLuInput(prepareAccess, person.id, id);
			const v1 = proposal(packet, 'Meeting preference');
			v1.streams[0].topics.push({
				...v1.streams[0].topics[0],
				key: 'context',
				title: 'Conversation context',
				contextualMeaningIds: ['m']
			});
			const personStream = packet.baselines[1];
			v1.meanings.push({
				...v1.meanings[0],
				id: 'person-meaning',
				subjectId: personStream.subjectId
			});
			v1.streams.push({
				subjectId: personStream.subjectId,
				perspectiveId: personStream.perspectiveId,
				baselineRevisionId: null,
				topics: [
					{
						...v1.streams[0].topics[0],
						key: 'person-view',
						title: 'Person perspective',
						meaningIds: ['person-meaning']
					}
				]
			});
			await t.test(
				'summary version is independent of transcript and approval eligibility',
				async () => {
					const before = await count('FoundationSourceVersion');
					assert.deepEqual(
						await conversations.editConversationSummary(saveAccess, person.id, id, 1, 'Owner edit'),
						{ version: 2 }
					);
					assert.deepEqual(
						await conversations.editConversationSummary(saveAccess, person.id, id, 1, 'Owner edit'),
						{ version: 2 }
					);
					await assert.rejects(
						conversations.editConversationSummary(saveAccess, person.id, id, 1, 'Stale edit'),
						/conflicts/
					);
					assert.equal(await count('FoundationSourceVersion'), before);
					assert.deepEqual(await lu.prepareLuInput(prepareAccess, person.id, id), packet);
					assert.equal(
						(await conversations.readPersonConversation(readAccess, person.id, id)).summary,
						'Owner edit'
					);
				}
			);
			const destination = {
				subjectId: packet.baselines[0].subjectId,
				perspectiveId: packet.baselines[0].perspectiveId
			};
			await t.test('candidate binding and competing approvals', async () => {
				await assert.rejects(
					lu.storeLuCandidate(
						storeAccess,
						person.id,
						{ ...packet, scope: { ...packet.scope, epoch: 999 } },
						v1
					),
					/conflicts/
				);
				const ready = await lu.storeLuCandidate(storeAccess, person.id, packet, v1);
				assert.equal(ready.outcome, 'READY');
				assert.equal(await lu.readLuRevision(readLu, destination), null);
				await assert.rejects(
					lu.approveLuCandidate(
						await grant('APPROVE_LU', 'other'),
						ready.candidateId,
						selection(v1, 'foreign')
					),
					/unavailable/
				);
				const attempts = await Promise.allSettled(
					['first', 'second'].map((key) =>
						lu.approveLuCandidate(approveAccess, ready.candidateId, selection(v1, key))
					)
				);
				assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
				const winner = attempts.findIndex((r) => r.status === 'fulfilled');
				assert.deepEqual(
					await lu.approveLuCandidate(
						approveAccess,
						ready.candidateId,
						selection(v1, ['first', 'second'][winner])
					),
					attempts[winner].value
				);
				assert.equal(await count('FoundationLuApproval'), 1);
				assert.equal(await count('FoundationLuRevision'), 2);
				assert.equal(
					(await lu.readLuRevision(readLu, personStream)).topics[0].title,
					'Person perspective'
				);
				const origin = (await db.query('SELECT * FROM "FoundationLuMeaningOrigin"')).rows[0];
				assert.equal(origin.generatorKind, 'MODEL_DRAFTED');
				assert.equal(origin.epistemicBasis, 'DIRECT_ACCOUNT');
				const anchor = await evidence.readEvidenceSegment(
					await grant('READ_SEGMENT'),
					origin.primarySegmentId
				);
				assert.equal(anchor.turnId, 'T2');
				assert.equal(anchor.excerpt, initial.turns[1].text);
				assert.equal(await count('FoundationSupport'), 5);
				assert.equal(await count('FoundationEvidenceSegment'), 4);
				assert.ok(
					(await db.query('SELECT role FROM "FoundationLuTopicMeaning"')).rows.some(
						(row) => row.role === 'CONTEXTUAL'
					)
				);
				assert.equal(
					(await evidence.listPersonNotes(await grant('READ_NOTES'), person.id)).notes.length,
					1
				);
			});

			const old = await lu.readLuRevision(readLu, destination);
			const followup = await conversations.savePersonConversation(
				saveAccess,
				person.id,
				capture('followup', 'I still prefer mornings.'),
				'Second summary',
				human
			);
			await conversations.reviseConversationSource(
				reviseAccess,
				person.id,
				followup.sourceId,
				1,
				'PRIVATE_ANALYSIS'
			);
			const next = await lu.prepareLuInput(prepareAccess, person.id, followup.sourceId);
			const v2 = proposal(next, 'Second topic', { update: true });
			await t.test('new revision keeps exact prior meaning and historical snapshot', async () => {
				const ready = await lu.storeLuCandidate(storeAccess, person.id, next, v2);
				const stale = await lu.storeLuCandidate(storeAccess, person.id, next, v2);
				await lu.approveLuCandidate(approveAccess, ready.candidateId, selection(v2, 'revision-2'));
				await assert.rejects(
					lu.approveLuCandidate(approveAccess, stale.candidateId, selection(v2, 'stale')),
					/conflicts/
				);
				const current = await lu.readLuRevision(readLu, destination);
				assert.equal(current.revisionNumber, 2);
				assert.deepEqual(await lu.readLuRevision(readLu, destination, 1), old);
				assert.equal(current.topics[0].topicId, old.topics[0].topicId);
				assert.equal(current.topics[0].version, 2);
				assert.equal(current.topics[0].meaningVersionIds[0], old.topics[0].meaningVersionIds[0]);
				assert.deepEqual(current.topics[1], old.topics[1]);
				assert.equal(current.topics[2].title, 'Second topic');
				const noChange = await lu.prepareLuInput(prepareAccess, person.id, followup.sourceId);
				const stored = await lu.storeLuCandidate(storeAccess, person.id, noChange, {
					contract: 'LUR-1',
					sourceVersionId: noChange.source.versionId,
					sourceContentMac: noChange.source.contentMac,
					meanings: [],
					streams: [],
					exclusions: []
				});
				assert.equal(stored.outcome, 'NO_CHANGE');
				assert.equal(await count('FoundationLuRevision'), 3);
			});
			await t.test(
				'withdrawal hides only dependent topics and rolls back a stale retained-evidence approval',
				async () => {
					const pending = await lu.prepareLuInput(prepareAccess, person.id, followup.sourceId);
					const draft = proposal(pending, null, { update: true });
					const { candidateId } = await lu.storeLuCandidate(storeAccess, person.id, pending, draft);
					await conversations.reviseConversationSource(
						reviseAccess,
						person.id,
						id,
						2,
						'STORED_ONLY'
					);
					assert.equal(await lu.readLuRevision(readLu, destination, 1), null);
					assert.deepEqual(
						(await lu.readLuRevision(readLu, destination)).topics.map((t) => t.title),
						['Second topic']
					);
					await assert.rejects(
						lu.approveLuCandidate(approveAccess, candidateId, selection(draft, 'withdrawn')),
						/unavailable/
					);
					assert.equal(await count('FoundationLuApproval'), 2);
					assert.equal(await count('FoundationLuRevision'), 3);
					assert.deepEqual(
						(await conversations.readPersonConversation(readAccess, person.id, id)).turns,
						initial.turns
					);
				}
			);

			await t.test(
				'SQL custody and immutable snapshots survive guarded access and reviewed erasure',
				async () => {
					const otherSave = await grant('SAVE_CONVERSATION', 'other');
					await conversations.savePersonConversation(
						otherSave,
						otherPerson.id,
						capture('other', 'Other private text'),
						'Other summary',
						human
					);
					await assert.rejects(
						db.exec('UPDATE "FoundationLuTopicVersion" SET "contentEnc" = \'new\'')
					);
					await assert.rejects(
						db.exec(`INSERT INTO "FoundationLuStream" (id,"ownerUserId","vaultId","subjectId","perspectiveId")
				SELECT 'forged', 'owner', v.id, s.id, p.id FROM "FoundationVault" v, "FoundationSubject" s, "FoundationPerspective" p
				WHERE v."ownerUserId"='owner' AND s."ownerUserId"='other' LIMIT 1`)
					);
					await assert.rejects(
						db.exec(`INSERT INTO "FoundationLuRevisionTopic"
				(id,"ownerUserId","vaultId","revisionId","streamId","topicId","topicVersionId",position)
				SELECT 'wrong-version', r."ownerUserId", r."vaultId", r."revisionId", r."streamId",
					t.id, v.id, 20
				FROM "FoundationLuRevisionTopic" r JOIN "FoundationLuTopicVersion" v
					ON v."streamId"=r."streamId" AND v."topicId"<>r."topicId"
				JOIN "FoundationLuTopic" t ON t."streamId"=r."streamId" AND t.id<>v."topicId"
				WHERE NOT EXISTS (SELECT 1 FROM "FoundationLuRevisionTopic" m WHERE m."revisionId"=r."revisionId" AND m."topicId"=t.id)
				LIMIT 1`),
						(error) => error.code === '23503'
					);
					const review = await privacy.reviewFoundationPrivacy('owner');
					assert.equal(review.conversationSummaries.length, 3);
					assert.equal(review.luTopics.length, 5);
					assert.ok(!JSON.stringify(review).includes('conv_first'));
					const racingPacket = await lu.prepareLuInput(prepareAccess, person.id, followup.sourceId);
					const racingProposal = proposal(racingPacket, 'Racing topic');
					const pending = await lu.storeLuCandidate(
						storeAccess,
						person.id,
						racingPacket,
						racingProposal
					);
					const race = await Promise.allSettled([
						conversations.reviseConversationSource(
							reviseAccess,
							person.id,
							followup.sourceId,
							2,
							'PRIVATE_ANALYSIS',
							{ ...capture('followup', 'Corrected speaker text'), reason: 'Corrected the wording' }
						),
						lu.approveLuCandidate(
							approveAccess,
							pending.candidateId,
							selection(racingProposal, 'racing')
						)
					]);
					assert.equal(race[0].status, 'fulfilled');
					if (race[1].status === 'rejected') assert.match(String(race[1].reason), /conflicts/);
					assert.equal(await lu.readLuRevision(readLu, destination), null);
					await privacy.suspendFoundationPrivacy('owner');
					await assert.rejects(
						conversations.readPersonConversation(readAccess, person.id, id),
						/unavailable/
					);
					assert.ok((await privacy.eraseFoundationPrivacy('owner')).erasedRows > 0);
					assert.equal((await privacy.eraseFoundationPrivacy('owner')).erasedRows, 0);
					assert.equal(await count('FoundationLuTopicVersion'), 0);
					assert.equal(await count('FoundationLuCandidate'), 0);
					assert.equal(await count('FoundationLuApproval'), 0);
					assert.equal(await count('FoundationSourcePresentationVersion'), 1);
					assert.equal(
						(await privacy.reviewFoundationPrivacy('other')).conversationSummaries[0].summary,
						'Other summary'
					);
				}
			);
			await t.test(
				'LUR-3 and LUR-4 assess, edit and approve authorised transcripts across two revisions',
				async () => {
					await db.exec(`INSERT INTO "User"(id) VALUES ('stranger');`);
					await provision.prepareFoundationAccount('stranger');
					await db.exec(`UPDATE "FoundationEnrollment" SET state='ACTIVE',epoch=epoch+1 WHERE "userId"='stranger';`);
					await runLuAssessmentCases({
						load,
						vite,
						otherPersonId: person.id,
						grant,
						personId: otherPerson.id,
						conversations,
						lu,
						count
					});
				}
			);
		} finally {
			await prisma?.$disconnect();
			await vite?.close();
			await socket?.stop();
			await db?.close();
		}
	}
);
