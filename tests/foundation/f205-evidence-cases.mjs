// Uses the disposable database and actual Prisma extension from the F-204 integration fixture.
import assert from 'node:assert/strict';
import test from 'node:test';

export async function exerciseEvidence({ vite, db, endpoint }) {
	const svc = await vite.ssrLoadModule('/src/lib/server/foundation/evidence.ts');
	const policy = await vite.ssrLoadModule('/src/lib/server/foundation/policy.ts');
	const subjects = await vite.ssrLoadModule('/src/lib/server/foundation/subjects.ts');
	const provision = await vite.ssrLoadModule('/src/lib/server/foundation/provisioning.ts');
	await db.exec(`INSERT INTO "User" VALUES ('writer'),('visitor')`);
	const { selfSubjectId } = await provision.prepareFoundationAccount('writer');
	await provision.prepareFoundationAccount('visitor');
	const grant = (operation, id = 'writer') =>
		policy.resolvePreparedFoundationAccess({ user: { id } }, operation);
	const directory = await grant('WRITE'),
		record = await grant('RECORD_EVIDENCE'),
		inspect = await grant('READ_SEGMENT'),
		derive = await grant('RECORD_STATEMENT'),
		recall = await grant('READ_STATEMENT');
	const person = await subjects.createPerson(directory, 'Friend');
	const relationship = await subjects.createRelationship(directory, 'Our relationship', [
		selfSubjectId,
		person.id
	]);
	const perspective = await subjects.createPerspective(directory, 'OWNER_RECORDED');
	const subjectIds = [person.id, relationship.id];
	const note = {
		key: 'note-1',
		expectedVersion: 0,
		text: 'A🙂 meeting. Private remainder.',
		start: 1,
		end: 3,
		quote: '🙂',
		subjectIds
	};
	const claim = {
		key: 'claim-1',
		expectedVersion: 0,
		subjectIds,
		perspectiveId: perspective.id,
		text: 'An owner observation',
		mode: 'OBSERVED',
		confidence: 'MEDIUM'
	};
	let original, admitted, saved;
	await test('one owner note has two subjects and its segment exposes only the exact excerpt', async () => {
		original = await svc.appendOwnerNote(record, note);
		assert.deepEqual(
			await svc.appendOwnerNote(record, { ...note, subjectIds: [...subjectIds].reverse() }),
			original
		);
		const result = await svc.readEvidenceSegment(inspect, original.segmentId);
		assert.deepEqual(result, {
			id: original.segmentId,
			excerpt: '🙂',
			start: 1,
			end: 3,
			encoding: 'UTF-16',
			speakerId: null,
			subjectIds: result.subjectIds
		});
		assert.deepEqual([...result.subjectIds].sort(), [...subjectIds].sort());
		await assert.rejects(
			svc.appendOwnerNote(record, { ...note, text: note.text + ' altered' }),
			/conflict/
		);
		await assert.rejects(
			svc.appendOwnerNote(record, { ...note, key: 'split', end: 2, quote: note.text.slice(1, 2) }),
			/offset/
		);
		await assert.rejects(svc.appendOwnerNote(record, { ...note, key: 'bad', quote: 'x' }), /match/);
	});
	await test('a failed subject association rolls back evidence, version and root together', async () => {
		await db.exec(
			`CREATE FUNCTION f205_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER f205_fail BEFORE INSERT ON "FoundationEvidenceSubject" FOR EACH ROW EXECUTE FUNCTION f205_fail();`
		);
		try {
			await assert.rejects(svc.appendOwnerNote(record, { ...note, key: 'retry-after-failure' }));
		} finally {
			await db.exec(
				'DROP TRIGGER f205_fail ON "FoundationEvidenceSubject"; DROP FUNCTION f205_fail();'
			);
		}
		const retry = await svc.appendOwnerNote(record, {
			...note,
			key: 'retry-after-failure',
			text: note.text + ' changed'
		});
		assert.equal(retry.version, 1);
		await assert.rejects(
			policy.withFoundationAccess(inspect, 'READ_SEGMENT', (tx) =>
				tx.foundationSourceVersion.findFirst({ select: { payloadEnc: true } })
			),
			/unavailable/
		);
	});
	await test('stored-only admission and distinct operations are enforced', async () => {
		await assert.rejects(
			svc.appendSupportedStatement(derive, { ...claim, segmentId: original.segmentId }),
			/unavailable/
		);
		await assert.rejects(svc.readEvidenceSegment(recall, original.segmentId), /unavailable/);
		await assert.rejects(svc.appendOwnerNote(directory, note), /unavailable/);
		await assert.rejects(svc.appendOwnerNote({ ...record }, note), /unavailable/);
	});
	await test('owner-approved successor supports a statement with an independent perspective', async () => {
		admitted = await svc.appendOwnerNote(record, {
			...note,
			expectedVersion: 1,
			allowPrivateAnalysis: true,
			speakerId: person.id
		});
		const input = { ...claim, segmentId: admitted.segmentId };
		saved = await svc.appendSupportedStatement(derive, input);
		assert.deepEqual(await svc.appendSupportedStatement(derive, input), saved);
		const result = await svc.readCurrentStatement(recall, saved.statementId);
		assert.equal(result.perspectiveId, perspective.id);
		assert.equal(result.text, claim.text);
		assert.deepEqual(result.subjectIds.sort(), [...subjectIds].sort());
		assert.ok(!('excerpt' in result) && !('payload' in result));
		await assert.rejects(
			svc.appendSupportedStatement(derive, { ...input, text: 'different' }),
			/conflict/
		);
		const next = await svc.appendSupportedStatement(derive, {
			...input,
			text: 'Corrected observation',
			expectedVersion: 1
		});
		assert.equal(next.version, 2);
		assert.equal(
			(await svc.readCurrentStatement(recall, saved.statementId)).text,
			'Corrected observation'
		);
	});
	await test('another owner cannot reference subjects, inspect excerpts or recall a statement', async () => {
		const foreignWrite = await grant('RECORD_EVIDENCE', 'visitor');
		await assert.rejects(svc.appendOwnerNote(foreignWrite, note), /unavailable/);
		await assert.rejects(
			svc.readEvidenceSegment(await grant('READ_SEGMENT', 'visitor'), original.segmentId),
			/unavailable/
		);
		await assert.rejects(
			svc.readCurrentStatement(await grant('READ_STATEMENT', 'visitor'), saved.statementId),
			/unavailable/
		);
	});
	await test('attributed declaration requires a matching speaker and AI perspective requires inference', async () => {
		const attributed = await subjects.createPerspective(
			directory,
			'ATTRIBUTED_PERSON',
			selfSubjectId
		);
		const ai = await subjects.createPerspective(directory, 'AI_INTERPRETATION');
		for (const p of [attributed, ai, perspective])
			await assert.rejects(
				svc.appendSupportedStatement(derive, {
					...claim,
					key: 'bad-attribution',
					segmentId: admitted.segmentId,
					perspectiveId: p.id,
					mode: 'DECLARED'
				}),
				/unavailable/
			);
	});
	await test('correction and withdrawal preserve original anchors and suppress stale understanding', async () => {
		const corrected = await svc.appendOwnerNote(record, {
			...note,
			allowPrivateAnalysis: true,
			expectedVersion: 2,
			text: 'Later: updated',
			start: 7,
			end: 14,
			quote: 'updated'
		});
		assert.equal((await svc.readEvidenceSegment(inspect, original.segmentId)).excerpt, '🙂');
		await assert.rejects(svc.readCurrentStatement(recall, saved.statementId), /unavailable/);
		await assert.rejects(
			svc.appendSupportedStatement(derive, {
				...claim,
				key: 'old-support',
				segmentId: admitted.segmentId
			}),
			/unavailable/
		);
		await svc.appendSupportedStatement(derive, {
			...claim,
			expectedVersion: 2,
			segmentId: corrected.segmentId
		});
		assert.equal((await svc.readCurrentStatement(recall, saved.statementId)).version, 3);
		await svc.appendOwnerNote(record, {
			...note,
			expectedVersion: 3,
			text: 'Later: updated',
			start: 7,
			end: 14,
			quote: 'updated',
			allowPrivateAnalysis: false
		});
		await assert.rejects(svc.readCurrentStatement(recall, saved.statementId), /unavailable/);
	});
	await test(
		'two writers correcting the same revision yield one committed successor',
		{ skip: !endpoint },
		async () => {
			const input = { ...note, expectedVersion: 4 };
			const results = await Promise.allSettled([
				svc.appendOwnerNote(record, input),
				svc.appendOwnerNote(record, { ...input, text: note.text + ' again' })
			]);
			assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
			const loser = results.find((r) => r.status === 'rejected');
			assert.match(loser.reason.message, /conflict/);
		}
	);
}
