// Shared persistent budgets prevent settings and guest claims from resetting abuse limits.
import type { AppTransactionClient } from '$lib/db';
import { runFoundationBoundary } from './internal';
import { claimMac } from './exchangeCrypto';
// All budget operations are serialized by the exchange lock. Hashes avoid storing IP or phone in counters.
export async function budget(tx: AppTransactionClient, actorId: string, keys: [string, number][]) {
	return runFoundationBoundary({ ownerUserId: actorId, mode: 'EXCHANGE_BUDGET' }, async () => {
		const hour = Math.floor(Date.now() / 3600000);
		await tx.foundationClaimBudget.deleteMany({ where: { expiresAt: { lte: new Date() } } });
		for (const [key, limit] of keys) {
			const id = claimMac(hour + ':' + key, 'budget');
			const row = await tx.foundationClaimBudget.findUnique({ where: { id } });
			if (row && row.count >= limit) return false;
		}
		for (const [key] of keys) {
			const id = claimMac(hour + ':' + key, 'budget');
			const changed = await tx.foundationClaimBudget.updateMany({
				where: { id },
				data: { count: { increment: 1 } }
			});
			if (!changed.count)
				await tx.foundationClaimBudget.create({
					data: { id, count: 1, expiresAt: new Date((hour + 1) * 3600000) }
				});
		}
		return true;
	});
}
