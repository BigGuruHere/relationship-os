// F-203: shared account identity stays separate from private-domain provisioning.
// Only the new-account transaction or the internal DEV fixture tool activates a fresh account.
import { randomUUID } from 'node:crypto';
import type { AppTransactionClient } from '$lib/db';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { devPilotEnabled, DEV_PILOT_ID_PREFIX } from './devPilotGate';
import { encryptedUserEmailFields } from '$lib/server/userEmail';
import { defaultProfileData } from '$lib/server/profiles';
import { error } from '@sveltejs/kit';
import { runFoundationBoundary } from './internal';

export type AccountDomain = 'LEGACY' | 'PREPARED' | 'ACTIVE' | 'SUSPENDED';

export async function accountDomain(
	userId: string,
	client: Pick<AppTransactionClient, 'foundationEnrollment'> = prisma
): Promise<AccountDomain> {
	const row = await runFoundationBoundary({ ownerUserId: userId, mode: 'RESOLVE' }, () =>
		client.foundationEnrollment.findUnique({
			where: { userId },
			select: { state: true }
		})
	);
	return row?.state ?? 'LEGACY';
}

// PREPARED accounts still use the legacy public routes until their writer handoff.
export async function usesLegacyProfileServices(userId: string) {
	const domain = await accountDomain(userId);
	return domain === 'LEGACY' || domain === 'PREPARED';
}

// Serialize preparation and automatic claims, including the first enrollment insert.
// Future activation/suspension services must take this same lock before transitioning.
export async function lockFoundationAccount(tx: AppTransactionClient, userId: string) {
	if (!userId) throw new Error('Missing authenticated account.');
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`foundation:account:${userId}`}, 0))`;
}

async function provisionPrivateHome(tx: AppTransactionClient, userId: string) {
	let vault = await tx.foundationVault.findUnique({
		where: { ownerUserId_kind: { ownerUserId: userId, kind: 'PRIVATE_HOME' } }
	});
	if (!vault)
		vault = await tx.foundationVault.create({
			data: { ownerUserId: userId, kind: 'PRIVATE_HOME' }
		});
	// Never reactivate or move a locked/deleting vault as an authentication side effect.
	if (vault.state !== 'ACTIVE') throw new Error('Foundation provisioning unavailable.');
	let self = await tx.foundationSubject.findUnique({ where: { selfUserId: userId } });
	if (!self) {
		const id = randomUUID();
		self = await tx.foundationSubject.create({
			data: {
				id,
				ownerUserId: userId,
				vaultId: vault.id,
				kind: 'PERSON',
				selfUserId: userId,
				// A neutral self label imports no private legacy/profile data. Bind ciphertext to custody and row.
				displayNameEnc: encrypt(
					'Me',
					`foundation:v1:FoundationSubject:displayNameEnc:${userId}:${vault.id}:${id}`
				)
			}
		});
	}
	if (
		self.ownerUserId !== userId ||
		self.vaultId !== vault.id ||
		self.kind !== 'PERSON' ||
		self.state !== 'ACTIVE'
	) {
		throw new Error('Foundation provisioning unavailable.');
	}
	return { vaultId: vault.id, selfSubjectId: self.id };
}

// Internal preparation primitive, not a general API or an enrollment authorizer.
// Call only from a separately approved server rollout/invitation workflow. No callers ship in F-203.
export async function prepareFoundationAccount(userId: string) {
	return runFoundationBoundary({ ownerUserId: userId, mode: 'PROVISION' }, () =>
		prisma.$transaction(async (tx) => {
			await lockFoundationAccount(tx, userId);
			const account = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
			if (!account) throw new Error('Account unavailable.');
			let enrollment = await tx.foundationEnrollment.findUnique({ where: { userId } });
			if (!enrollment)
				enrollment = await tx.foundationEnrollment.create({ data: { userId, state: 'PREPARED' } });
			if (enrollment.state !== 'PREPARED') throw new Error('Account is not prepared.');
			return provisionPrivateHome(tx, userId);
		})
	);
}

// Owner-only DEV setup. A new identity and its ACTIVE roots commit together, so no
// legacy People writer or public profile ever sees a halfway-provisioned test account.
export async function createDevPilotAccount(
	locals: Pick<App.Locals, 'user' | 'env'>,
	origin: string,
	passwordHash: string,
	limit: 1 | 2 = 1
) {
	if (!devPilotEnabled(locals, origin)) throw error(404, 'DEV foundation pilot unavailable.');
	const actorId = locals.user?.id;
	if (!actorId || locals.user?.role !== 'owner') throw error(403, 'Owner access is required.');
	const nonce = randomUUID();
	const id = DEV_PILOT_ID_PREFIX + nonce;
	const email = 'foundation-' + nonce + '@example.invalid';
	return prisma.$transaction(
		async (tx) => {
			// This lock serializes simultaneous clicks even when no pilot row exists yet.
			await lockFoundationAccount(tx, DEV_PILOT_ID_PREFIX);
			// Recheck authority under the same lock used by database updates to the owner row.
			await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actorId} FOR UPDATE`;
			const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
			if (actor?.role !== 'owner') throw error(403, 'Owner access is required.');
			const existing = await tx.user.count({ where: { id: { startsWith: DEV_PILOT_ID_PREFIX } } });
			if (existing >= limit) throw error(409, 'A DEV foundation test account already exists.');
			await tx.user.create({
				data: {
					id,
					role: 'member',
					passwordHash,
					...encryptedUserEmailFields(email),
					person: { create: {} },
					profiles: {
						create: defaultProfileData({
							displayName: 'Relish foundation test',
							isPublished: false
						})
					}
				},
				select: { id: true }
			});
			await provisionNewFoundationAccount(tx, id);
			return { email };
		},
		{ isolationLevel: 'ReadCommitted', timeout: 15000 }
	);
}

// All supported credential paths call createSession only after verifying identity.
// Preparation failures block session issuance; they cannot fall through to legacy claims.
export async function provisionAccountForSession(userId: string) {
	return runFoundationBoundary({ ownerUserId: userId, mode: 'PROVISION' }, () =>
		prisma.$transaction(async (tx) => {
			await lockFoundationAccount(tx, userId);
			const enrollment = await tx.foundationEnrollment.findUnique({ where: { userId } });
			if (!enrollment || enrollment.state === 'SUSPENDED') return;
			if (enrollment.state === 'PREPARED') {
				await provisionPrivateHome(tx, userId);
				return;
			}
			// ACTIVE accounts must already have a complete provisioned root. Never repair by switching storage.
			const vault = await tx.foundationVault.findUnique({
				where: { ownerUserId_kind: { ownerUserId: userId, kind: 'PRIVATE_HOME' } }
			});
			const self = await tx.foundationSubject.findUnique({ where: { selfUserId: userId } });
			if (
				!vault ||
				vault.state !== 'ACTIVE' ||
				!self ||
				self.vaultId !== vault.id ||
				self.ownerUserId !== userId ||
				self.kind !== 'PERSON' ||
				self.state !== 'ACTIVE'
			) {
				throw new Error('Foundation provisioning unavailable.');
			}
		})
	);
}

// Claims are optional legacy side effects. Even PREPARED accounts must not acquire
// reciprocal identity links during an internal foundation trial. Failures never authorize fallback.
export async function withLegacyAccountClaims<T>(
	userId: string,
	legacy: (tx: AppTransactionClient) => Promise<T>,
	skipped: T
): Promise<T> {
	return runFoundationBoundary({ ownerUserId: userId, mode: 'RESOLVE' }, () =>
		prisma.$transaction(
			async (tx) => {
				await lockFoundationAccount(tx, userId);
				if (
					await tx.foundationEnrollment.findUnique({ where: { userId }, select: { userId: true } })
				)
					return skipped;
				// Use the same connection for claims and their enrollment lock, including small pools.
				return legacy(tx);
			},
			{ timeout: 20000 }
		)
	);
}

// Legacy People adapters must reject ACTIVE/SUSPENDED owners. The shipped directory,
// capture and notes select their Foundation services independently.
export async function requireLegacyPeopleDomain(
	userId: string,
	transaction?: AppTransactionClient
) {
	// Capture can span a cohort change. Hold the account lock through the actual legacy write.
	if (transaction) await lockFoundationAccount(transaction, userId);
	const domain = await accountDomain(userId, transaction);
	if (domain === 'ACTIVE' || domain === 'SUSPENDED') {
		const { error } = await import('@sveltejs/kit');
		throw error(503, 'People storage is temporarily unavailable.');
	}
}

// Call only inside the transaction that inserts this new User. A pre-existing
// enrollment cannot be replaced, and any failure rolls back the whole signup.
export async function provisionNewFoundationAccount(tx: AppTransactionClient, userId: string) {
	await runFoundationBoundary({ ownerUserId: userId, mode: 'PROVISION' }, async () => {
		await lockFoundationAccount(tx, userId);
		await provisionPrivateHome(tx, userId);
		await tx.foundationEnrollment.create({ data: { userId, state: 'ACTIVE' } });
	});
}
