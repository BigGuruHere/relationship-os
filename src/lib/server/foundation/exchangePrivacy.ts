// Operator-only dependency cleanup. Call with the exchange lock before any account/vault lock.
import type { AppTransactionClient } from '$lib/db';
import { runFoundationBoundary } from './internal';
import { exchangeScope } from './exchangeAuthority';

export async function removeExchangeDependencies(
	tx: AppTransactionClient,
	ownerId: string,
	erase: boolean
) {
	const incoming = await runFoundationBoundary(
		{ ownerUserId: ownerId, mode: 'EXCHANGE_LOOKUP' },
		() =>
			tx.foundationExchange.findMany({
				where: { beneficiaryUserId: ownerId },
				select: { id: true, ownerUserId: true, vaultId: true }
			})
	);
	// Owned roots are resolved under the caller's privacy authority.
	const vault = await tx.foundationVault.findFirst({
		where: { ownerUserId: ownerId, kind: 'PRIVATE_HOME' },
		select: { id: true }
	});
	if (!vault) return 0;
	let removed = 0;
	const root = { ownerUserId: ownerId, vaultId: vault.id };
	const owned = await exchangeScope(root, () =>
		tx.foundationExchange.findMany({ select: { id: true, ownerUserId: true, vaultId: true } })
	);
	const exchanges = [...new Map([...incoming, ...owned].map((row) => [row.id, row])).values()];
	for (const exchange of exchanges) {
		await exchangeScope(exchange, async () => {
			const challenges = await tx.foundationExchangeChallenge.findMany({
				where: { exchangeId: exchange.id },
				select: { id: true }
			});
			for (const challenge of challenges) {
				if (erase)
					removed += (
						await tx.foundationExchangeDispatch.deleteMany({ where: { challengeId: challenge.id } })
					).count;
				else
					await tx.foundationExchangeDispatch.updateMany({
						where: { challengeId: challenge.id, status: { in: ['QUEUED', 'FAILED', 'SENDING'] } },
						data: { status: 'CANCELLED', payloadEnc: null, leaseToken: null, leaseUntil: null }
					});
			}
			if (erase) {
				removed += (
					await tx.foundationExchangeChallenge.deleteMany({ where: { exchangeId: exchange.id } })
				).count;
				removed += (await tx.foundationExchange.deleteMany({ where: { id: exchange.id } })).count;
			} else {
				await tx.foundationExchangeChallenge.updateMany({
					where: { exchangeId: exchange.id, status: { in: ['PENDING', 'VERIFIED'] } },
					data: { status: 'REVOKED' }
				});
				await tx.foundationExchange.updateMany({
					where: { id: exchange.id, status: { in: ['PENDING', 'BOUND', 'SETTLED'] } },
					data: { status: 'REVOKED' }
				});
			}
		});
	}
	const incomingAssociations = await runFoundationBoundary(
		{ ownerUserId: ownerId, mode: 'EXCHANGE_LOOKUP' },
		() =>
			tx.foundationAccountAssociation.findMany({
				where: { accountId: ownerId },
				select: { id: true, ownerUserId: true, vaultId: true }
			})
	);
	const ownedAssociations = await exchangeScope(root, () =>
		tx.foundationAccountAssociation.findMany({
			select: { id: true, ownerUserId: true, vaultId: true }
		})
	);
	for (const row of [
		...new Map([...incomingAssociations, ...ownedAssociations].map((r) => [r.id, r])).values()
	]) {
		const changed = await exchangeScope(row, () =>
			erase
				? tx.foundationAccountAssociation.deleteMany({ where: { id: row.id } })
				: tx.foundationAccountAssociation.updateMany({
						where: { id: row.id },
						data: { state: 'REVOKED' }
					})
		);
		if (erase) removed += changed.count;
	}
	return removed;
}
