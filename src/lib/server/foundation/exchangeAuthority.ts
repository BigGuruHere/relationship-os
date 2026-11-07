// Internal exchange operations share one lock with privacy controls for this bounded pilot.
// This serializes cross-account settlement and outbound dispatch without inverse account locks.
import { prisma, type AppTransactionClient } from '$lib/db';
import { ExchangeDenied } from './exchangeDiagnostics';
import { FoundationDenied, runFoundationBoundary } from './internal';
import { lockActiveFoundationRoot } from './policy';

export async function lockExchanges(tx: AppTransactionClient) {
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'foundation:exchanges:v1'}, 0))`;
}

export async function exchangeTransaction<T>(
	actorId: string,
	operation: (tx: AppTransactionClient) => Promise<T>
) {
	return runFoundationBoundary({ ownerUserId: actorId, mode: 'EXCHANGE_LOOKUP' }, () =>
		prisma.$transaction(
			async (tx) => {
				await lockExchanges(tx);
				return operation(tx);
			},
			{ isolationLevel: 'ReadCommitted', timeout: 25000 }
		)
	);
}

export async function exchangeRoots(tx: AppTransactionClient, owners: string[]) {
	const roots = new Map<string, { ownerUserId: string; vaultId: string }>();
	for (const ownerUserId of [...new Set(owners)].sort()) {
		const root = await runFoundationBoundary({ ownerUserId, mode: 'RESOLVE' }, () =>
			lockActiveFoundationRoot(tx, ownerUserId, false)
		).catch((failure) => {
			if (failure instanceof FoundationDenied)
				throw new ExchangeDenied(
					ownerUserId === owners[0] ? 'SOURCE_ROOT_INACTIVE' : 'CLAIMANT_ROOT_INACTIVE'
				);
			throw failure;
		});
		roots.set(ownerUserId, { ownerUserId, vaultId: root.vaultId });
	}
	return roots;
}

export function exchangeScope<T>(
	root: { ownerUserId: string; vaultId: string },
	operation: () => Promise<T>
) {
	return runFoundationBoundary({ ...root, mode: 'EXCHANGE' }, operation);
}

export async function requireClaimSession(
	tx: AppTransactionClient,
	locals: Pick<App.Locals, 'user' | 'sessionId'>
) {
	if (!locals.user?.id || !locals.sessionId) throw new ExchangeDenied('SESSION_INVALID');
	// Serialize revocation with the complete verification transaction.
	await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${locals.sessionId} FOR UPDATE`;
	const session = await tx.session.findFirst({
		where: { id: locals.sessionId, userId: locals.user.id, expiresAt: { gt: new Date() } },
		select: { id: true }
	});
	if (!session) throw new ExchangeDenied('SESSION_INVALID');
	return { accountId: locals.user.id, sessionId: session.id };
}
