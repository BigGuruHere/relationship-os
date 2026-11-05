// Owner-private authority, resolved from authenticated server locals. No visitor/agent delegation ships.
import { prisma, type AppTransactionClient } from '$lib/db';
import { FoundationDenied, runFoundationBoundary } from './internal';
import { lockFoundationAccount } from './provisioning';
export type FoundationOperation =
	| 'READ'
	| 'WRITE'
	| 'RECORD_EVIDENCE'
	| 'READ_SEGMENT'
	| 'RECORD_STATEMENT'
	| 'READ_STATEMENT';
export type FoundationAccess = Readonly<{
	actorId: string;
	ownerUserId: string;
	vaultId: string;
	epoch: number;
	operation: FoundationOperation;
	purpose: 'PRIVATE_DIRECTORY' | 'PRIVATE_EVIDENCE' | 'PRIVATE_UNDERSTANDING';
}>;
const issued = new WeakMap<object, { prepared: boolean }>();

async function current(tx: AppTransactionClient, ownerUserId: string, prepared: boolean) {
	await lockFoundationAccount(tx, ownerUserId);
	const enrollment = await tx.foundationEnrollment.findUnique({ where: { userId: ownerUserId } });
	const vault = await tx.foundationVault.findFirst({
		where: { ownerUserId, kind: 'PRIVATE_HOME' }
	});
	if (!enrollment || enrollment.state !== (prepared ? 'PREPARED' : 'ACTIVE') || !vault)
		throw new FoundationDenied();
	// Coordinate vault lifecycle changes and graph writers with the same root row lock.
	await tx.$queryRaw`SELECT "id" FROM "FoundationVault" WHERE "id" = ${vault.id} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
	const fresh = await tx.foundationVault.findUnique({ where: { id: vault.id } });
	if (fresh?.state !== 'ACTIVE') throw new FoundationDenied();
	const self = await tx.foundationSubject.findUnique({
		where: { selfUserId: ownerUserId },
		select: { vaultId: true, kind: true, state: true }
	});
	if (!self || self.vaultId !== vault.id || self.kind !== 'PERSON' || self.state !== 'ACTIVE')
		throw new FoundationDenied();
	return { vaultId: vault.id, epoch: enrollment.epoch };
}
function purposeFor(operation: FoundationOperation): FoundationAccess['purpose'] {
	switch (operation) {
		case 'READ':
		case 'WRITE':
			return 'PRIVATE_DIRECTORY';
		case 'READ_SEGMENT':
		case 'RECORD_EVIDENCE':
			return 'PRIVATE_EVIDENCE';
		default:
			return 'PRIVATE_UNDERSTANDING';
	}
}
async function resolve(
	locals: Pick<App.Locals, 'user'>,
	operation: FoundationOperation,
	prepared: boolean
): Promise<FoundationAccess> {
	const ownerUserId = locals.user?.id;
	if (
		!ownerUserId ||
		![
			'READ',
			'WRITE',
			'RECORD_EVIDENCE',
			'READ_SEGMENT',
			'RECORD_STATEMENT',
			'READ_STATEMENT'
		].includes(operation)
	)
		throw new FoundationDenied();
	return runFoundationBoundary({ ownerUserId, mode: 'RESOLVE' }, () =>
		prisma.$transaction(async (tx) => {
			const root = await current(tx, ownerUserId, prepared);
			const access = Object.freeze({
				actorId: ownerUserId,
				ownerUserId,
				...root,
				operation,
				purpose: purposeFor(operation)
			});
			issued.set(access, { prepared });
			return access;
		})
	);
}
export function resolveFoundationAccess(
	locals: Pick<App.Locals, 'user'>,
	operation: FoundationOperation
) {
	return resolve(locals, operation, false);
}
// Internal rehearsal only, no route caller. Never use a browser flag to choose this resolver.
export function resolvePreparedFoundationAccess(
	locals: Pick<App.Locals, 'user'>,
	operation: FoundationOperation
) {
	return resolve(locals, operation, true);
}
// Repository-only entry. Rechecks state/epoch under lock, including reads and delayed operations.
// A copied/JSON-deserialized access object is not authority. Future jobs require separate authorization.
export async function withFoundationAccess<T>(
	access: FoundationAccess,
	operation: FoundationOperation,
	fn: (tx: AppTransactionClient) => Promise<T>
) {
	const record = access && issued.get(access);
	if (!record || access.operation !== operation || access.actorId !== access.ownerUserId)
		throw new FoundationDenied();
	return runFoundationBoundary({ ownerUserId: access.ownerUserId, mode: 'RESOLVE' }, () =>
		prisma.$transaction(
			async (tx) => {
				const root = await current(tx, access.ownerUserId, record.prepared);
				if (root.vaultId !== access.vaultId || root.epoch !== access.epoch)
					throw new FoundationDenied();
				return runFoundationBoundary(
					{ ownerUserId: access.ownerUserId, vaultId: access.vaultId, mode: operation },
					() => fn(tx)
				);
			},
			{ timeout: 10000 }
		)
	);
}
