// Owner-private authority and narrowly scoped public intake. Neither delegates general owner access.
import { prisma, type AppTransactionClient } from '$lib/db';
import { FoundationDenied, runFoundationBoundary } from './internal';
import { error } from '@sveltejs/kit';
import { buildScopedMacToken } from '$lib/crypto';
import { verifyContactCaptureToken } from '$lib/server/core/contactCaptureToken';
import { lockFoundationAccount } from './provisioning';
import { dorianConsentVersion, dorianProviderWindowMs, foundationDorianAgent, foundationDorianPhoneAgent } from './dorianCallConfig';

type DorianGrant = { kind: 'worker'; lease: string } | { kind: 'operator'; actorId: string } | { kind: 'launch' };
type DorianBinding = { id: string; subjectId: string; sourceId: string | null; candidateId: string | null; conversationId: string; agentId: string; telephone: boolean };
const dorianOperations = {
	worker: ['SAVE_CONVERSATION', 'PREPARE_LU', 'STORE_LU_CANDIDATE'],
	operator: ['READ_CONVERSATION', 'STORE_LU_CANDIDATE', 'APPROVE_LU', 'READ_LU'],
	launch: ['READ_LU', 'READ_CONVERSATION']
} satisfies Record<DorianGrant['kind'], FoundationOperation[]>;
// Match capture receipts to the exact shared profile within the owner's vault.
export function captureProfilePrefix(profileId: string, vaultId: string) {
	return 'exchange:v1:' + buildScopedMacToken(profileId, 'foundation:' + vaultId + ':capture-profile') + ':';
}

export type FoundationOperation =
	| 'READ'
	| 'WRITE'
	| 'RECORD_EVIDENCE'
	| 'READ_SEGMENT'
	| 'RECORD_STATEMENT'
	| 'READ_STATEMENT'
	| 'READ_NOTES'
	| 'REVIEW_NOTE'
	| 'PROCESS_DRAFT'
	| 'SAVE_CONVERSATION'
	| 'READ_CONVERSATION'
	| 'REVISE_CONVERSATION_SOURCE'
	| 'PREPARE_LU'
	| 'STORE_LU_CANDIDATE'
	| 'APPROVE_LU'
	| 'READ_LU';
export type FoundationAccess = Readonly<{
	actorId: string;
	dorian?: Readonly<DorianBinding>;
	ownerUserId: string;
	vaultId: string;
	epoch: number;
	operation: FoundationOperation;
	purpose:
		| 'PRIVATE_DIRECTORY'
		| 'PRIVATE_EVIDENCE'
		| 'PRIVATE_UNDERSTANDING'
		| 'PRIVATE_DRAFT_PROCESSING';
}>;
const issued = new WeakMap<object, { prepared: boolean; grant?: DorianGrant }>();

async function checkDorianGrant(tx: AppTransactionClient, id: string, ownerUserId: string,
	root: { vaultId: string; epoch: number }, grant: DorianGrant) {
	const call = await tx.dorianFoundationCall.findUnique({ where: { id } });
	if (!foundationDorianAgent() || !call || call.consentVersion !== dorianConsentVersion ||
		call.ownerUserId !== ownerUserId || call.vaultId !== root.vaultId || call.epoch !== root.epoch)
		throw new FoundationDenied();
	if (grant.kind === 'worker' &&
		(call.lease !== grant.lease || call.state !== 'QUEUED'))
		throw new FoundationDenied();
	if (grant.kind === 'launch') {
		const agent = call.phoneChannelId ? foundationDorianPhoneAgent() : foundationDorianAgent();
		if (call.agentId !== agent || Date.now() - call.createdAt.getTime() > dorianProviderWindowMs ||
			(call.phoneChannelId && call.state !== 'QUEUED'))
			throw new FoundationDenied();
	}
	if (grant.kind === 'operator') {
		// Check the current account role at each use, including the approval transaction.
		const actor = await tx.user.findUnique({ where: { id: grant.actorId }, select: { role: true } });
		if (actor?.role !== 'owner' || !call.sourceId) throw new FoundationDenied();
	}
	return call;
}

// Issue access for a single consented launch. The scheduler lease or operator
// identity is checked again under the participant's account lock on every use.
export async function resolveDorianCallAccess(id: string, grant: DorianGrant, operation: FoundationOperation) {
	const allowed: FoundationOperation[] = dorianOperations[grant.kind];
	if (!allowed.includes(operation)) throw new FoundationDenied();
	const target = await prisma.dorianFoundationCall.findUnique({ where: { id }, select: { ownerUserId: true } });
	if (!target) throw new FoundationDenied();
	const { ownerUserId } = target;
	return runFoundationBoundary({ ownerUserId, mode: 'RESOLVE' }, () =>
		prisma.$transaction(async (tx) => {
			const root = await lockActiveFoundationRoot(tx, ownerUserId, false);
			const call = await checkDorianGrant(tx, id, ownerUserId, root, grant);
			const access = Object.freeze({
				...root, ownerUserId, operation, purpose: purposeFor(operation),
				actorId: grant.kind === 'operator' ? grant.actorId : 'DORIAN_FOUNDATION_SERVICE',
				dorian: Object.freeze({ id, subjectId: call.subjectId, sourceId: call.sourceId, candidateId: call.candidateId,
					conversationId: call.conversationId, agentId: call.agentId, telephone: Boolean(call.phoneChannelId) })
			});
			issued.set(access, { prepared: false, grant: Object.freeze({ ...grant }) });
			return access;
		})
	);
}

export async function lockActiveFoundationRoot(
	tx: AppTransactionClient,
	ownerUserId: string,
	prepared: boolean
) {
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
// Only the telephone admission service and account-channel repository can
// open this transaction. They verify the call or revalidate the exact channel.
export function withDorianTelephoneAccount<T>(
	ownerUserId: string,
	run: (tx: AppTransactionClient, root: { vaultId: string; epoch: number }) => Promise<T>
) {
	return runFoundationBoundary({ ownerUserId, mode: 'RESOLVE' }, () =>
		prisma.$transaction(async (tx) => run(tx, await lockActiveFoundationRoot(tx, ownerUserId, false)))
	);
}

function purposeFor(operation: FoundationOperation): FoundationAccess['purpose'] {
	switch (operation) {
		case 'READ':
		case 'WRITE':
			return 'PRIVATE_DIRECTORY';
		case 'PROCESS_DRAFT':
			return 'PRIVATE_DRAFT_PROCESSING';
		case 'SAVE_CONVERSATION':
		case 'READ_CONVERSATION':
		case 'REVISE_CONVERSATION_SOURCE':
		case 'READ_NOTES':
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
			'READ_STATEMENT',
			'READ_NOTES',
			'REVIEW_NOTE',
			'PROCESS_DRAFT',
			'SAVE_CONVERSATION',
			'READ_CONVERSATION',
			'REVISE_CONVERSATION_SOURCE',
			'PREPARE_LU',
			'STORE_LU_CANDIDATE',
			'APPROVE_LU',
			'READ_LU'
		].includes(operation)
	)
		throw new FoundationDenied();
	return runFoundationBoundary({ ownerUserId, mode: 'RESOLVE' }, () =>
		prisma.$transaction(async (tx) => {
			const root = await lockActiveFoundationRoot(tx, ownerUserId, prepared);
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
	if (!record || access.operation !== operation || (!record.grant && access.actorId !== access.ownerUserId))
		throw new FoundationDenied();
	return runFoundationBoundary({ ownerUserId: access.ownerUserId, mode: 'RESOLVE' }, () =>
		prisma.$transaction(
			async (tx) => {
				const root = await lockActiveFoundationRoot(tx, access.ownerUserId, record.prepared);
				if (root.vaultId !== access.vaultId || root.epoch !== access.epoch)
					throw new FoundationDenied();
				if (record.grant && access.dorian) {
					const current = await checkDorianGrant(tx, access.dorian.id, access.ownerUserId, root, record.grant);
					if (current.sourceId !== access.dorian.sourceId || current.candidateId !== access.dorian.candidateId)
						throw new FoundationDenied();
				}
				return runFoundationBoundary(
					{ ownerUserId: access.ownerUserId, vaultId: access.vaultId, mode: operation },
					() => fn(tx)
				);
			},
			{ timeout: 10000 }
		)
	);
}

// Only the capture repository may call this boundary. The token is independently verified here.
// The profile owner is always read from the database, never supplied as authority by the visitor.
export async function withPublicCapture(
	profileId: string,
	token: unknown,
	browser: string,
	record: (
		tx: AppTransactionClient,
		intake: {
			ownerUserId: string;
			vaultId: string;
			prefix: string;
			nonce: string;
			via: 'qr' | 'event' | 'profile_link';
			profileId: string;
			profileKind: string;
		}
	) => Promise<void>
): Promise<void> {
	try {
		verifyContactCaptureToken(token, profileId, browser);
	} catch {
		throw error(403, 'This form has expired. Reload the page and try again.');
	}
	const candidate = await prisma.profile.findFirst({
		where: { id: profileId, isPublished: true },
		select: { userId: true }
	});
	if (!candidate) throw error(404, 'Profile unavailable.');
	await runFoundationBoundary({ ownerUserId: candidate.userId, mode: 'RESOLVE' }, () =>
		prisma.$transaction(
			async (tx) => {
				let root;
				try {
					root = await lockActiveFoundationRoot(tx, candidate.userId, false);
				} catch (e) {
					if (e instanceof FoundationDenied)
						throw error(503, 'People storage is temporarily unavailable.');
					throw e;
				}
				// Row lock coordinates publication/ownership updates as well as concurrent captures.
				await tx.$queryRaw`SELECT "id" FROM "Profile" WHERE "id" = ${profileId} FOR UPDATE`;
				const profile = await tx.profile.findFirst({
					where: { id: profileId, userId: candidate.userId, isPublished: true },
					select: { id: true, kind: true }
				});
				if (!profile) throw error(404, 'Profile unavailable.');
				// A queued request must still be within the token lifetime after waiting for locks.
				let receipt;
				try {
					receipt = verifyContactCaptureToken(token, profileId, browser);
				} catch {
					throw error(403, 'This form has expired. Reload the page and try again.');
				}
				const prefix = captureProfilePrefix(profileId, root.vaultId);
				await runFoundationBoundary(
					{
						ownerUserId: candidate.userId,
						vaultId: root.vaultId,
						mode: 'PUBLIC_CAPTURE',
						capturePrefix: prefix
					},
					() =>
						record(tx, {
							ownerUserId: candidate.userId,
							vaultId: root.vaultId,
							prefix,
							profileId,
							profileKind: profile.kind,
							...receipt
						})
				);
				// Deliberately discard callback results. Public intake never returns private record IDs or data.
			},
			{ isolationLevel: 'ReadCommitted', timeout: 10000 }
		)
	);
}
