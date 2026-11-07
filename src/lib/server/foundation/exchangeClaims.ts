// Server-only claim service. Route callers supply authenticated locals and server-resolved client address.
import { randomInt, randomUUID } from 'node:crypto';
import type { AppTransactionClient } from '$lib/db';
import type { FoundationExchange } from '@prisma/client';
import { FoundationDenied, runFoundationBoundary } from './internal';
import {
	exchangeTransaction,
	exchangeRoots,
	exchangeScope,
	requireClaimSession
} from './exchangeAuthority';
import { claimMac, sameMac, seal, open, verificationPhone } from './exchangeCrypto';
import { insertExchangeReceipt } from './exchangeReceipt';
import { insertPrivatePerson } from './subjects';
import { sendTelnyxSms } from '$lib/server/integrations/telnyx/messaging';
import { devPilotEnabled } from './devPilotGate';

type Actor = Pick<App.Locals, 'user' | 'sessionId' | 'env' | 'appOrigin'>;
type Root = { ownerUserId: string; vaultId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function lookup(tx: AppTransactionClient, continuation: string) {
	if (!/^[0-9a-f]{64}$/.test(continuation)) throw new FoundationDenied();
	const rows = await tx.foundationExchange.findMany({
		where: { continuationHash: claimMac(continuation, 'lookup') },
		select: { id: true, ownerUserId: true, vaultId: true },
		take: 1
	});
	if (!rows[0]) throw new FoundationDenied();
	return rows[0];
}
async function withClaim<T>(
	locals: Actor,
	continuation: string,
	fn: (
		tx: AppTransactionClient,
		exchange: FoundationExchange,
		actor: { accountId: string; sessionId: string },
		recipient: Root
	) => Promise<T>
) {
	if (!locals.user?.id) throw new FoundationDenied();
	return exchangeTransaction(locals.user.id, async (tx) => {
		const actor = await requireClaimSession(tx, locals);
		const located = await lookup(tx, continuation);
		// Self-scans cannot create a reciprocal account association.
		if (located.ownerUserId === actor.accountId) throw new FoundationDenied();
		const roots = await exchangeRoots(tx, [located.ownerUserId, actor.accountId]);
		return exchangeScope(located, async () => {
			const exchange = await tx.foundationExchange.findFirst({ where: { id: located.id } });
			if (
				!exchange ||
				(exchange.beneficiaryUserId && exchange.beneficiaryUserId !== actor.accountId)
			)
				throw new FoundationDenied();
			// Publication withdrawal must serialize with delivery and settlement.
			await tx.$queryRaw`SELECT "id" FROM "Profile" WHERE "id" = ${exchange.profileId} FOR UPDATE`;
			const profile = await tx.profile.findFirst({
				where: { id: exchange.profileId, userId: exchange.ownerUserId, isPublished: true },
				select: { id: true }
			});
			const person = await tx.foundationSubject.findFirst({
				where: { id: exchange.subjectId, state: 'ACTIVE' },
				select: { id: true }
			});
			if (
				!profile ||
				!person ||
				!['PENDING', 'BOUND', 'SETTLED'].includes(exchange.status) ||
				(exchange.status !== 'SETTLED' && exchange.expiresAt.getTime() <= Date.now())
			)
				throw new FoundationDenied();
			return fn(tx, exchange, actor, roots.get(actor.accountId)!);
		});
	});
}
// All budget operations are serialized by the exchange lock. Hashes avoid storing IP or phone in counters.
async function budget(tx: AppTransactionClient, actorId: string, keys: [string, number][]) {
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
async function cancelPending(tx: AppTransactionClient, exchangeId: string) {
	const pending = await tx.foundationExchangeChallenge.findMany({
		where: { exchangeId, status: 'PENDING' },
		select: { id: true }
	});
	for (const challenge of pending) {
		await tx.foundationExchangeDispatch.updateMany({
			where: { challengeId: challenge.id, status: { in: ['QUEUED', 'FAILED', 'SENDING'] } },
			data: { status: 'CANCELLED', payloadEnc: null, leaseToken: null, leaseUntil: null }
		});
	}
	await tx.foundationExchangeChallenge.updateMany({
		where: { exchangeId, status: 'PENDING' },
		data: { status: 'REVOKED' }
	});
}
export async function requestExchangeCode(
	locals: Actor,
	continuation: string,
	requestId: string,
	clientAddress: string
) {
	if (!uuid.test(requestId) || !clientAddress || clientAddress.length > 200)
		throw new FoundationDenied();
	return withClaim(locals, continuation, async (tx, e, actor) => {
		// Scrub dormant expired outbox payloads for this source owner before another send.
		await tx.foundationExchangeDispatch.updateMany({
			where: { expiresAt: { lte: new Date() }, status: { in: ['QUEUED', 'FAILED', 'SENDING'] } },
			data: { status: 'EXPIRED', payloadEnc: null, leaseToken: null, leaseUntil: null }
		});
		if (e.status === 'SETTLED') return { status: 'SETTLED' as const };
		const sessionHash = claimMac(actor.sessionId, 'session');
		const retry = await tx.foundationExchangeChallenge.findFirst({
			where: { id: requestId, exchangeId: e.id }
		});
		if (retry) {
			if (
				retry.sessionHash !== sessionHash ||
				retry.status !== 'PENDING' ||
				retry.expiresAt.getTime() <= Date.now()
			)
				throw new FoundationDenied();
			return { status: 'QUEUED' as const, challengeId: retry.id };
		}
		if (e.failedAttempts >= 5 || e.sendCount >= 5 || !e.destinationEnc)
			throw new FoundationDenied();
		const phone = verificationPhone(
			open('FoundationExchange', 'destinationEnc', e, e.id, e.destinationEnc)
		);
		const latest = await tx.foundationExchangeChallenge.findFirst({
			where: { exchangeId: e.id },
			orderBy: { generation: 'desc' },
			select: { createdAt: true }
		});
		if (latest && Date.now() - latest.createdAt.getTime() < 60000)
			return { status: 'LIMITED' as const };
		if (
			!(await budget(tx, actor.accountId, [
				['send:account:' + actor.accountId, 10],
				['send:phone:' + phone, 5],
				['send:origin:' + clientAddress, 30],
				['send:global', 100]
			]))
		)
			return { status: 'LIMITED' as const };
		await cancelPending(tx, e.id);
		const code = String(randomInt(0, 1000000)).padStart(6, '0');
		const expiresAt = new Date(Math.min(Date.now() + 900000, e.expiresAt.getTime()));
		await tx.foundationExchange.updateMany({
			where: { id: e.id },
			data: {
				beneficiaryUserId: actor.accountId,
				status: 'BOUND',
				generation: { increment: 1 },
				sendCount: { increment: 1 }
			}
		});
		await tx.foundationExchangeChallenge.create({
			data: {
				id: requestId,
				ownerUserId: e.ownerUserId,
				vaultId: e.vaultId,
				exchangeId: e.id,
				beneficiaryUserId: actor.accountId,
				sessionHash,
				channel: 'SMS',
				destinationEnc: seal('FoundationExchangeChallenge', 'destinationEnc', e, requestId, phone),
				codeMac: claimMac(code, 'code:' + requestId),
				generation: e.generation + 1,
				expiresAt
			}
		});
		const id = randomUUID();
		await tx.foundationExchangeDispatch.create({
			data: {
				id,
				ownerUserId: e.ownerUserId,
				vaultId: e.vaultId,
				challengeId: requestId,
				expiresAt,
				payloadEnc: seal('FoundationExchangeDispatch', 'payloadEnc', e, id, { phone, code })
			}
		});
		return { status: 'QUEUED' as const, challengeId: requestId };
	});
}

export async function dispatchExchangeCode(
	locals: Actor,
	continuation: string,
	challengeId: string
) {
	return withClaim(locals, continuation, async (tx, e, actor) => {
		const challenge = await tx.foundationExchangeChallenge.findFirst({
			where: { id: challengeId, exchangeId: e.id }
		});
		if (
			!challenge ||
			challenge.sessionHash !== claimMac(actor.sessionId, 'session') ||
			challenge.generation !== e.generation ||
			challenge.status !== 'PENDING'
		)
			throw new FoundationDenied();
		const dispatch = await tx.foundationExchangeDispatch.findFirst({ where: { challengeId } });
		if (!dispatch) throw new FoundationDenied();
		if (dispatch.status === 'SENT') return { status: 'SENT' as const };
		if (challenge.expiresAt.getTime() <= Date.now() || dispatch.attempts >= 3) {
			await tx.foundationExchangeDispatch.updateMany({
				where: { id: dispatch.id },
				data: { status: 'EXPIRED', payloadEnc: null, leaseToken: null, leaseUntil: null }
			});
			return { status: 'EXPIRED' as const };
		}
		if (!dispatch.payloadEnc || !['QUEUED', 'FAILED'].includes(dispatch.status))
			throw new FoundationDenied();
		const payload = open(
			'FoundationExchangeDispatch',
			'payloadEnc',
			e,
			dispatch.id,
			dispatch.payloadEnc
		);
		const phone = verificationPhone(payload.phone);
		const allowed = (process.env.RELISH_EXCHANGE_TEST_PHONES ?? '').split(',').filter(Boolean);
		// Pilot sends require the existing exact DEV target/origin guard and an explicit destination allowlist.
		if (!devPilotEnabled(locals, locals.appOrigin) || !allowed.includes(phone))
			throw new FoundationDenied();
		await tx.foundationExchangeDispatch.updateMany({
			where: { id: dispatch.id },
			data: {
				status: 'SENDING',
				attempts: { increment: 1 },
				leaseToken: randomUUID(),
				leaseUntil: new Date(Date.now() + 20000)
			}
		});
		try {
			// Hold the pilot exchange/privacy locks through the bounded provider call.
			await sendTelnyxSms(
				phone,
				'Relish verification code: ' +
					payload.code +
					'. Enter it in the Relish page where you requested it. Expires in 15 minutes.'
			);
			await tx.foundationExchangeDispatch.updateMany({
				where: { id: dispatch.id },
				data: {
					status: 'SENT',
					payloadEnc: null,
					leaseToken: null,
					leaseUntil: null,
					lastErrorCode: null
				}
			});
			return { status: 'SENT' as const };
		} catch {
			await tx.foundationExchangeDispatch.updateMany({
				where: { id: dispatch.id },
				data: {
					status: 'FAILED',
					leaseToken: null,
					leaseUntil: null,
					lastErrorCode: 'DELIVERY_FAILED'
				}
			});
			return { status: 'FAILED' as const };
		}
	});
}

async function association(
	tx: AppTransactionClient,
	root: Root,
	accountId: string,
	subjectId: string,
	channelHash: string,
	exchangeRef: string
) {
	const prior = await tx.foundationAccountAssociation.findFirst({ where: { accountId } });
	if (prior) {
		const person = await tx.foundationSubject.findFirst({
			where: { id: prior.subjectId, state: 'ACTIVE' },
			select: { id: true }
		});
		if (prior.state !== 'ACTIVE' || !person) throw new FoundationDenied();
		return prior.subjectId;
	}
	await tx.foundationAccountAssociation.create({
		data: {
			ownerUserId: root.ownerUserId,
			vaultId: root.vaultId,
			subjectId,
			accountId,
			channel: 'SMS',
			channelHash,
			verifiedAt: new Date(),
			exchangeRef
		}
	});
	return subjectId;
}

export async function verifyExchangeCode(
	locals: Actor,
	continuation: string,
	challengeId: string,
	code: string,
	clientAddress: string
) {
	if (!clientAddress || clientAddress.length > 200 || typeof code !== 'string' || code.length > 100)
		throw new FoundationDenied();
	return withClaim(locals, continuation, async (tx, e, actor, recipient) => {
		const challenge = await tx.foundationExchangeChallenge.findFirst({
			where: { id: challengeId, exchangeId: e.id }
		});
		if (
			!challenge ||
			challenge.sessionHash !== claimMac(actor.sessionId, 'session') ||
			challenge.generation !== e.generation
		)
			throw new FoundationDenied();
		if (e.status === 'SETTLED' && challenge.status === 'CONSUMED')
			return { status: 'SETTLED' as const, personId: e.settledSubjectId };
		if (
			challenge.status !== 'PENDING' ||
			challenge.expiresAt.getTime() <= Date.now() ||
			e.failedAttempts >= 5
		)
			throw new FoundationDenied();
		const phone = verificationPhone(
			open(
				'FoundationExchangeChallenge',
				'destinationEnc',
				e,
				challenge.id,
				challenge.destinationEnc
			)
		);
		if (
			!(await budget(tx, actor.accountId, [
				['verify:account:' + actor.accountId, 20],
				['verify:phone:' + phone, 20],
				['verify:origin:' + clientAddress, 100]
			]))
		)
			return { status: 'LIMITED' as const };
		if (!sameMac(challenge.codeMac, claimMac(code, 'code:' + challenge.id))) {
			await tx.foundationExchangeChallenge.updateMany({
				where: { id: challenge.id },
				data: { attempts: { increment: 1 } }
			});
			await tx.foundationExchange.updateMany({
				where: { id: e.id },
				data: { failedAttempts: { increment: 1 } }
			});
			return { status: 'INVALID' as const };
		}
		const channelHash = claimMac(phone, 'channel');
		const conflicts = await runFoundationBoundary(
			{ ownerUserId: actor.accountId, mode: 'EXCHANGE_LOOKUP' },
			() =>
				tx.foundationAccountAssociation.findMany({
					where: { channelHash },
					select: { accountId: true }
				})
		);
		if (conflicts.some((row) => row.accountId !== actor.accountId)) throw new FoundationDenied();
		// The original contact keeps its ID and private history. Existing verified entries are reused
		// only for the reciprocal direction, never by matching names, phones or emails.
		const existing = await tx.foundationAccountAssociation.findFirst({
			where: { accountId: actor.accountId }
		});
		if (existing && existing.subjectId !== e.subjectId) throw new FoundationDenied();
		await association(tx, e, actor.accountId, e.subjectId, channelHash, e.id);
		const personId = await exchangeScope(recipient, async () => {
			const prior = await tx.foundationAccountAssociation.findFirst({
				where: { accountId: e.ownerUserId }
			});
			if (prior) return association(tx, recipient, e.ownerUserId, prior.subjectId, '', e.id);
			const snapshot = open('FoundationExchange', 'snapshotEnc', e, e.id, e.snapshotEnc);
			const person = await insertPrivatePerson(tx, recipient, snapshot, {
				submittedAt: new Date().toISOString(),
				profileId: e.profileId,
				sourceId: e.sourceId
			});
			await insertExchangeReceipt(tx, recipient, person.id, snapshot, e.id, e.profileId);
			// The published card establishes the sharer's account. It is distinct from SMS assurance.
			await tx.foundationAccountAssociation.create({
				data: {
					...recipient,
					subjectId: person.id,
					accountId: e.ownerUserId,
					channel: 'PROFILE',
					channelHash: '',
					verifiedAt: new Date(),
					exchangeRef: e.id
				}
			});
			return person.id;
		});
		const now = new Date();
		await tx.foundationExchangeChallenge.updateMany({
			where: { id: challenge.id },
			data: { status: 'CONSUMED', verifiedAt: now, consumedAt: now }
		});
		await tx.foundationExchangeDispatch.updateMany({
			where: { challengeId: challenge.id, status: { in: ['QUEUED', 'FAILED', 'SENDING'] } },
			data: { status: 'CANCELLED', payloadEnc: null, leaseToken: null, leaseUntil: null }
		});
		await tx.foundationExchange.updateMany({
			where: { id: e.id },
			data: { status: 'SETTLED', settledSubjectId: personId, settledVaultId: recipient.vaultId }
		});
		return { status: 'SETTLED' as const, personId };
	});
}
