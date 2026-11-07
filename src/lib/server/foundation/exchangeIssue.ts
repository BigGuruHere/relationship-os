// Called inside successful public capture, using the already locked owner/profile and exact receipt.
import { randomUUID } from 'node:crypto';
import type { AppTransactionClient } from '$lib/db';
import { FoundationDenied } from './internal';
import { exchangeScope } from './exchangeAuthority';
import { claimMac, seal, verificationPhone } from './exchangeCrypto';

export async function issueCapturedExchange(
	tx: AppTransactionClient,
	intake: { ownerUserId: string; vaultId: string; profileId: string; nonce: string },
	browser: string,
	sourceId: string,
	personId: string | null,
	phone: string
) {
	const continuation = claimMac(
		JSON.stringify([intake.profileId, intake.nonce, browser]),
		'continuation'
	);
	return exchangeScope(intake, async () => {
		const prior = await tx.foundationExchange.findFirst({ where: { sourceId } });
		if (prior) return continuation;
		// A pre-existing receipt without a claim must be exchanged again.
		if (!personId) throw new FoundationDenied();
		const destination = verificationPhone(phone);
		const profile = await tx.profile.findFirst({
			where: { id: intake.profileId, userId: intake.ownerUserId, isPublished: true },
			select: { displayName: true, emailPublic: true, phonePublic: true }
		});
		if (!profile?.displayName) throw new FoundationDenied();
		const id = randomUUID();
		await tx.foundationExchange.create({
			data: {
				id,
				...{ ownerUserId: intake.ownerUserId, vaultId: intake.vaultId },
				profileId: intake.profileId,
				sourceId,
				subjectId: personId,
				snapshotEnc: seal('FoundationExchange', 'snapshotEnc', intake, id, {
					name: profile.displayName,
					email: profile.emailPublic ?? '',
					phone: profile.phonePublic ?? ''
				}),
				destinationEnc: seal('FoundationExchange', 'destinationEnc', intake, id, destination),
				continuationHash: claimMac(continuation, 'lookup'),
				expiresAt: new Date(Date.now() + 86400000)
			},
			select: { id: true }
		});
		return continuation;
	});
}
