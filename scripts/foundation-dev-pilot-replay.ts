// Replay the existing DEV pilot's vault erasure on isolated copies of one snapshot.
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { captureFailureMetadata } from '../src/lib/server/core/contactCaptureDiagnostics';
import { DEV_PILOT_ID_PREFIX } from '../src/lib/server/foundation/devPilotGate';
import { checkRehearsalTarget } from './foundation/operator-target';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let stage = 'arguments';

async function main() {
	const [command] = process.argv.slice(2);
	const confirmation = process.env.P306_CONFIRM?.match(/^erase-test-copy:([0-9a-f]{64})$/);
	if (
		process.argv.length !== 3 ||
		!['inspect', 'replay'].includes(command) ||
		(command === 'replay' && !confirmation)
	)
		throw new Error('Invalid pilot rehearsal command.');

	stage = 'target';
	checkRehearsalTarget();
	stage = 'key';
	if (!/^[0-9a-f]{64}$/i.test(process.env.SECRET_MASTER_KEY ?? ''))
		throw new Error('DEV encryption key required.');

	const { prisma } = await import('../src/lib/db');
	try {
		stage = 'pilot-identity';
		const { decryptUserEmail } = await import('../src/lib/server/userEmail');
		const users = await prisma.user.findMany({
			where: { id: { startsWith: DEV_PILOT_ID_PREFIX } },
			select: { id: true, role: true, email_Enc: true },
			take: 2
		});
		const [user] = users;
		const nonce = user?.id.slice(DEV_PILOT_ID_PREFIX.length);
		// Require the unique generated member and its matching reserved email. A
		// caller cannot supply an arbitrary account ID to this rehearsal command.
		if (
			users.length !== 1 ||
			user.role !== 'member' ||
			!uuid.test(nonce) ||
			decryptUserEmail(user.email_Enc) !== 'foundation-' + nonce + '@example.invalid'
		)
			throw new Error('Exactly one generated DEV pilot required.');

		stage = 'review';
		const { reviewFoundationPrivacy, suspendFoundationPrivacy, eraseFoundationPrivacy } =
			await import('../src/lib/server/foundation/privacyOperations');
		const { buildScopedMacToken } = await import('../src/lib/crypto');
		type Review = Awaited<ReturnType<typeof reviewFoundationPrivacy>>;
		const counts = (review: Review) =>
			Object.fromEntries(
				Object.entries(review)
					.filter(([, value]) => Array.isArray(value))
					.map(([name, rows]) => [name, (rows as unknown[]).length])
			);
		const empty = (review: Review) => Object.values(counts(review)).every((count) => count === 0);
		const locked = (review: Review) =>
			review.lifecycle.enrollment === 'SUSPENDED' && review.lifecycle.vault === 'LOCKED';
		const proof = ({ lifecycle, ...content }: Review) => {
			// The review is bounded and consistently ordered. Exclude lifecycle so
			// a failed erase can be retried after suspension without changing the proof.
			return buildScopedMacToken(JSON.stringify(content), 'foundation:p306:dev-pilot-replay');
		};
		const review = await reviewFoundationPrivacy(user.id);
		if (command === 'inspect' && locked(review) && empty(review)) {
			console.log(
				JSON.stringify({ verified: 'erased', ...review.lifecycle, counts: counts(review) })
			);
			return;
		}
		if (
			!(
				locked(review) ||
				(review.lifecycle.enrollment === 'ACTIVE' && review.lifecycle.vault === 'ACTIVE')
			) ||
			!review.sources.some(
				(source) =>
					['OWNER_NOTE', 'VOICE_NOTE'].includes(source.kind) &&
					review.sourceVersions.some(
						(version) => version.sourceId === source.id && version.text?.trim()
					)
			)
		)
			throw new Error('Pilot rehearsal requires readable test evidence.');

		const snapshotProof = proof(review);
		if (command === 'inspect') {
			// Only an opaque proof, fixed lifecycle values and counts leave the process.
			console.log(
				JSON.stringify({
					verified: 'ready',
					...review.lifecycle,
					counts: counts(review),
					proof: snapshotProof
				})
			);
			return;
		}
		stage = 'proof';
		if (
			!confirmation ||
			!timingSafeEqual(Buffer.from(snapshotProof, 'hex'), Buffer.from(confirmation[1], 'hex'))
		)
			throw new Error('Pilot snapshot proof did not match.');

		stage = 'suspend';
		await suspendFoundationPrivacy(user.id);
		const suspended = await reviewFoundationPrivacy(user.id);
		if (!locked(suspended) || proof(suspended) !== snapshotProof)
			throw new Error('Suspended pilot evidence did not match.');
		stage = 'erase';
		const result = await eraseFoundationPrivacy(user.id);
		stage = 'verify-erasure';
		const erased = await reviewFoundationPrivacy(user.id);
		if (!locked(erased) || !empty(erased)) throw new Error('Pilot erasure was not verified.');
		console.log(JSON.stringify({ verified: 'erased', ...result, counts: counts(erased) }));
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((failure) => {
	console.error(
		JSON.stringify({
			component: 'relish.foundation.dev-pilot-replay',
			reference: randomUUID(),
			stage,
			...captureFailureMetadata(failure)
		})
	);
	process.exitCode = 1;
});
