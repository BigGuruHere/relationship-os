// A synthetic fixture for the hosted DEV restore run. The operator supplies the separate clone.
import { randomUUID } from 'node:crypto';
import { captureFailureMetadata } from '../src/lib/server/core/contactCaptureDiagnostics';
import { checkOperatorTarget } from './foundation/operator-target';

const [command, caseRef, expected] = process.argv.slice(2);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validCommand = command === 'seed' || command === 'verify';
const original = 'P-306 synthetic note, version one.';
const corrected = 'P-306 synthetic note, version two.';

function checkClone() {
	const clone = checkOperatorTarget(process.env.P305_EXPECTED_TARGET);
	const sourceTarget = process.env.P306_SOURCE_TARGET ?? '';
	if (!/^[a-z0-9.-]+(?::[0-9]+)?\/[a-z0-9_-]+$/i.test(sourceTarget))
		throw new Error('Explicit source DEV endpoint required.');
	const source = new URL('postgresql://' + sourceTarget);
	// Treat pooled and direct Neon hosts as the same branch, even with a different database or port.
	const endpoint = (host: string) =>
		host
			.toLowerCase()
			.replace(/-pooler(?=\.)/, '')
			.replace(/\.$/, '');
	if (source.pathname !== clone.pathname || endpoint(source.hostname) === endpoint(clone.hostname))
		throw new Error('The source and rehearsal endpoints must be separate.');
}

async function main() {
	if (
		!validCommand ||
		!uuid.test(caseRef ?? '') ||
		(command === 'seed'
			? process.argv.length !== 4
			: process.argv.length !== 5 || !['prepared', 'suspended', 'erased'].includes(expected))
	)
		throw new Error('Invalid rehearsal command.');
	checkClone();
	if (command === 'seed' && process.env.P306_CONFIRM !== 'seed:' + caseRef)
		throw new Error('Explicit synthetic fixture confirmation required.');
	// The key is local to the disposable rehearsal and must survive both restore steps.
	if (!/^[0-9a-f]{64}$/i.test(process.env.SECRET_MASTER_KEY ?? ''))
		throw new Error('Rehearsal key required.');

	const account = 'p306-' + caseRef;
	const { prisma } = await import('../src/lib/db');
	try {
		const { reviewFoundationPrivacy } = await import(
			'../src/lib/server/foundation/privacyOperations'
		);
		if (command === 'seed') {
			const { prepareFoundationAccount } = await import(
				'../src/lib/server/foundation/provisioning'
			);
			const { resolvePreparedFoundationAccess } = await import(
				'../src/lib/server/foundation/policy'
			);
			const { createPerson } = await import('../src/lib/server/foundation/subjects');
			const { appendOwnerNote } = await import('../src/lib/server/foundation/evidence');
			// A duplicate case stops at User.create. Never attach fixture data to a prior account.
			// The fixture has no password, email, OAuth identity, public card or issued session.
			await prisma.user.create({ data: { id: account }, select: { id: true } });
			await prepareFoundationAccount(account);
			const locals = { user: { id: account } } as Pick<App.Locals, 'user'>;
			const write = await resolvePreparedFoundationAccess(locals, 'WRITE');
			const person = await createPerson(write, 'P-306 synthetic person');
			const record = await resolvePreparedFoundationAccess(locals, 'RECORD_EVIDENCE');
			const base = {
				key: 'p306-restore-note',
				start: 0,
				subjectIds: [person.id],
				allowPrivateAnalysis: false
			};
			await appendOwnerNote(record, {
				...base,
				expectedVersion: 0,
				text: original,
				end: original.length,
				quote: original
			});
			await appendOwnerNote(record, {
				...base,
				expectedVersion: 1,
				text: corrected,
				end: corrected.length,
				quote: corrected
			});
		}
		const review = await reviewFoundationPrivacy(account);
		const state = command === 'seed' ? 'prepared' : expected;
		const { enrollment, vault } = review.lifecycle;
		const versions = [...review.sourceVersions].sort((a, b) => a.version - b.version);
		const matches =
			state === 'erased'
				? enrollment === 'SUSPENDED' &&
					vault === 'LOCKED' &&
					Object.values(review).every((value) => !Array.isArray(value) || value.length === 0)
				: enrollment === (state === 'prepared' ? 'PREPARED' : 'SUSPENDED') &&
					vault === (state === 'prepared' ? 'ACTIVE' : 'LOCKED') &&
					review.subjects.length === 2 &&
					review.sources.length === 1 &&
					versions.length === 2 &&
					versions[0].text === original &&
					versions[1].text === corrected &&
					versions[1].previousVersionId === versions[0].id &&
					versions.every((version) => version.processingAdmission === 'STORED_ONLY');
		if (!matches) throw new Error('Synthetic rehearsal state did not match.');
		// Only the generated fixture identifier, fixed states and aggregate counts leave the process.
		console.log(
			JSON.stringify({
				caseRef,
				account,
				verified: state,
				enrollment,
				vault,
				subjects: review.subjects.length,
				sources: review.sources.length,
				versions: versions.length
			})
		);
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((failure) => {
	console.error(
		JSON.stringify({
			component: 'relish.foundation.restore-rehearsal',
			reference: randomUUID(),
			...captureFailureMetadata(failure)
		})
	);
	process.exitCode = 1;
});
