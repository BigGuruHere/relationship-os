// Account-owned proof service. No route can write channel status or choose another account.
import { randomInt, randomUUID } from 'node:crypto';
import type { AppTransactionClient } from '$lib/db';
import { encrypt, decrypt, normalizeEmail } from '$lib/crypto';
import { FoundationDenied, runFoundationBoundary } from './internal';
import { exchangeTransaction, exchangeRoots, requireClaimSession } from './exchangeAuthority';
import { claimMac, verificationPhone, sameMac } from './exchangeCrypto';
import { budget } from './exchangeClaims';
import { exchangeBrowserEnabled } from './devPilotGate';
import { sendTelnyxSms } from '$lib/server/integrations/telnyx/messaging';
type Actor = Pick<App.Locals, 'user' | 'sessionId' | 'env' | 'appOrigin'>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const aad = (account: string, id: string, field: string) =>
	`account-channel:v1:${account}:${id}:${field}`;
function canonical(type: string, value: string) {
	if (type === 'PHONE') return verificationPhone(value);
	if (type === 'EMAIL' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
		return normalizeEmail(value);
	throw new FoundationDenied();
}
function hash(type: string, value: string) {
	return claimMac(type + ':' + value, 'account-channel:lookup:v1');
}
async function scope<T>(
	locals: Actor,
	fn: (tx: AppTransactionClient, account: string) => Promise<T>
) {
	if (!locals.user || !exchangeBrowserEnabled(locals, locals.appOrigin))
		throw new FoundationDenied();
	return exchangeTransaction(locals.user.id, async (tx) => {
		const actor = await requireClaimSession(tx, locals);
		await exchangeRoots(tx, [actor.accountId]);
		return runFoundationBoundary({ ownerUserId: actor.accountId, mode: 'ACCOUNT_CHANNEL' }, () =>
			fn(tx, actor.accountId)
		);
	});
}
async function channel(tx: AppTransactionClient, id: string) {
	const row = await tx.foundationAccountChannel.findFirst({ where: { id } });
	if (!row) throw new FoundationDenied();
	return row;
}
// Scrub expired payloads on all admitted settings operations, including settings retrieval.
async function expire(tx: AppTransactionClient) {
	await tx.foundationAccountChannelDispatch.updateMany({
		where: { expiresAt: { lte: new Date() }, status: { in: ['QUEUED', 'FAILED'] } },
		data: { status: 'EXPIRED', payloadEnc: null }
	});
	await tx.foundationAccountChannelChallenge.updateMany({
		where: { expiresAt: { lte: new Date() }, status: 'PENDING' },
		data: { status: 'EXPIRED' }
	});
}
async function cancel(tx: AppTransactionClient, channelId: string) {
	const pending = await tx.foundationAccountChannelChallenge.findMany({
		where: { channelId, status: 'PENDING' },
		select: { id: true }
	});
	for (const c of pending)
		await tx.foundationAccountChannelDispatch.updateMany({
			where: { challengeId: c.id, status: { in: ['QUEUED', 'FAILED'] } },
			data: { status: 'CANCELLED', payloadEnc: null }
		});
	await tx.foundationAccountChannelChallenge.updateMany({
		where: { channelId, status: 'PENDING' },
		data: { status: 'REVOKED' }
	});
}
export async function listAccountChannels(locals: Actor) {
	return scope(locals, async (tx, account) => {
		await expire(tx);
		const rows = await tx.foundationAccountChannel.findMany({
			orderBy: { createdAt: 'asc' },
			take: 30
		});
		const out = [];
		for (const c of rows) {
			const value = decrypt(c.valueEnc, aad(account, c.id, 'value'));
			const proof = await tx.foundationAccountChannelVerification.findFirst({
				where: { channelId: c.id, generation: c.generation, revokedAt: null },
				select: { verifiedAt: true, method: true }
			});
			// Only masked values and proof metadata leave this account service.
			out.push({
				id: c.id,
				type: c.type,
				status: c.status,
				masked:
					c.type === 'PHONE' ? '•••• ' + value.slice(-4) : value[0] + '•••@' + value.split('@')[1],
				verifiedAt: proof?.verifiedAt.toISOString() ?? null,
				method: proof?.method ?? null
			});
		}
		return out;
	});
}
export async function addAccountChannel(locals: Actor, type: string, value: string) {
	const normalized = canonical(type, value);
	return scope(locals, async (tx, account) => {
		await expire(tx);
		const valueHash = hash(type, normalized);
		const prior = await tx.foundationAccountChannel.findFirst({ where: { type, valueHash } });
		if (prior) return prior.id;
		if ((await tx.foundationAccountChannel.count()) >= 20) throw new FoundationDenied();
		const id = randomUUID();
		await tx.foundationAccountChannel.create({
			data: {
				id,
				ownerUserId: account,
				type,
				valueHash,
				valueEnc: encrypt(normalized, aad(account, id, 'value'))
			}
		});
		return id;
	});
}
export async function requestAccountChannelCode(
	locals: Actor,
	id: string,
	requestId: string,
	address: string
) {
	if (!uuid.test(requestId) || !address || address.length > 200) throw new FoundationDenied();
	return scope(locals, async (tx, account) => {
		await expire(tx);
		let c = await channel(tx, id);
		if (c.type !== 'PHONE') throw new FoundationDenied();
		if (c.status === 'VERIFIED') return { status: 'VERIFIED' as const };
		const prior = await tx.foundationAccountChannelChallenge.findFirst({
			where: { id: requestId }
		});
		if (prior) {
			if (
				prior.channelId !== id ||
				prior.sessionHash !== claimMac(locals.sessionId!, 'session') ||
				prior.status !== 'PENDING' ||
				prior.generation !== c.generation
			)
				throw new FoundationDenied();
			return { status: 'QUEUED' as const, challengeId: prior.id };
		}
		const latest = await tx.foundationAccountChannelChallenge.findFirst({
			where: { channelId: id },
			orderBy: { createdAt: 'desc' }
		});
		if (latest && Date.now() - latest.createdAt.getTime() < 60000)
			return { status: 'LIMITED' as const };
		// An hourly channel window preserves failed attempts and sends across resends and revocation.
		if (Date.now() - c.windowAt.getTime() >= 3600000) {
			await tx.foundationAccountChannel.updateMany({
				where: { id },
				data: { windowAt: new Date(), failedAttempts: 0, sendCount: 0 }
			});
			c = await channel(tx, id);
		}
		if (c.failedAttempts >= 5 || c.sendCount >= 5) return { status: 'LIMITED' as const };
		const phone = verificationPhone(decrypt(c.valueEnc, aad(account, id, 'value')));
		if (
			!(await budget(tx, account, [
				['send:account:' + account, 10],
				['send:phone:' + phone, 5],
				['send:origin:' + address, 30],
				['send:global', 100]
			]))
		)
			return { status: 'LIMITED' as const };
		await cancel(tx, id);
		const code = String(randomInt(0, 1000000)).padStart(6, '0'),
			expiresAt = new Date(Date.now() + 900000);
		await tx.foundationAccountChannel.updateMany({
			where: { id },
			data: { generation: { increment: 1 }, status: 'PENDING', sendCount: { increment: 1 } }
		});
		await tx.foundationAccountChannelChallenge.create({
			data: {
				id: requestId,
				ownerUserId: account,
				channelId: id,
				generation: c.generation + 1,
				sessionHash: claimMac(locals.sessionId!, 'session'),
				codeMac: claimMac(code, 'account-channel:code:' + requestId),
				expiresAt
			}
		});
		const dispatchId = randomUUID();
		await tx.foundationAccountChannelDispatch.create({
			data: {
				id: dispatchId,
				ownerUserId: account,
				challengeId: requestId,
				expiresAt,
				payloadEnc: encrypt(JSON.stringify({ phone, code }), aad(account, dispatchId, 'dispatch'))
			}
		});
		return { status: 'QUEUED' as const, challengeId: requestId };
	});
}
export async function dispatchAccountChannelCode(locals: Actor, challengeId: string) {
	return scope(locals, async (tx, account) => {
		await expire(tx);
		const challenge = await tx.foundationAccountChannelChallenge.findFirst({
			where: { id: challengeId, status: 'PENDING' }
		});
		if (!challenge || challenge.sessionHash !== claimMac(locals.sessionId!, 'session'))
			throw new FoundationDenied();
		const c = await channel(tx, challenge.channelId);
		const d = await tx.foundationAccountChannelDispatch.findFirst({ where: { challengeId } });
		if (!d || c.status !== 'PENDING' || c.generation !== challenge.generation)
			throw new FoundationDenied();
		if (d.status === 'SENT') return 'SENT';
		if (!d.payloadEnc || !['QUEUED', 'FAILED'].includes(d.status) || d.attempts >= 3)
			throw new FoundationDenied();
		const payload = JSON.parse(decrypt(d.payloadEnc, aad(account, d.id, 'dispatch')));
		const allowed = (process.env.RELISH_EXCHANGE_TEST_PHONES || '').split(',').some((p) => {
			try {
				return verificationPhone(p.trim()) === payload.phone;
			} catch {
				return false;
			}
		});
		if (!allowed) throw new FoundationDenied();
		await tx.foundationAccountChannelDispatch.updateMany({
			where: { id: d.id },
			data: { attempts: { increment: 1 } }
		});
		try {
			await sendTelnyxSms(
				payload.phone,
				`Your Relish verification code: ${payload.code}. It expires in 15 minutes.`
			);
			await tx.foundationAccountChannelDispatch.updateMany({
				where: { id: d.id },
				data: { status: 'SENT', payloadEnc: null }
			});
			return 'SENT';
		} catch {
			await tx.foundationAccountChannelDispatch.updateMany({
				where: { id: d.id },
				data: {
					status: d.attempts >= 2 ? 'CANCELLED' : 'FAILED',
					...(d.attempts >= 2 ? { payloadEnc: null } : {})
				}
			});
			return 'FAILED';
		}
	});
}
export async function verifyAccountChannelCode(
	locals: Actor,
	challengeId: string,
	code: string,
	address: string
) {
	if (!address || address.length > 200 || code.length > 100) throw new FoundationDenied();
	return scope(locals, async (tx, account) => {
		await expire(tx);
		const ch = await tx.foundationAccountChannelChallenge.findFirst({ where: { id: challengeId } });
		if (!ch || ch.sessionHash !== claimMac(locals.sessionId!, 'session'))
			throw new FoundationDenied();
		const c = await channel(tx, ch.channelId);
		if (ch.generation !== c.generation) throw new FoundationDenied();
		if (ch.status === 'CONSUMED' && c.status === 'VERIFIED') return 'VERIFIED';
		if (ch.status !== 'PENDING' || c.status !== 'PENDING' || c.failedAttempts >= 5)
			throw new FoundationDenied();
		const phone = verificationPhone(decrypt(c.valueEnc, aad(account, c.id, 'value')));
		if (
			!(await budget(tx, account, [
				['verify:account:' + account, 20],
				['verify:phone:' + phone, 20],
				['verify:origin:' + address, 100]
			]))
		)
			return 'LIMITED';
		if (
			!/^[0-9]{6}$/.test(code) ||
			!sameMac(ch.codeMac, claimMac(code, 'account-channel:code:' + ch.id))
		) {
			await tx.foundationAccountChannelChallenge.updateMany({
				where: { id: ch.id },
				data: { attempts: { increment: 1 } }
			});
			await tx.foundationAccountChannel.updateMany({
				where: { id: c.id },
				data: { failedAttempts: { increment: 1 } }
			});
			return 'INVALID';
		}
		const now = new Date();
		await tx.foundationAccountChannelVerification.create({
			data: {
				ownerUserId: account,
				channelId: c.id,
				generation: c.generation,
				method: 'SMS_CODE',
				proofRef: ch.id,
				verifiedAt: now
			}
		});
		await tx.foundationAccountChannelChallenge.updateMany({
			where: { id: ch.id },
			data: { status: 'CONSUMED', consumedAt: now }
		});
		await tx.foundationAccountChannelDispatch.updateMany({
			where: { challengeId: ch.id, status: { in: ['QUEUED', 'FAILED'] } },
			data: { status: 'CANCELLED', payloadEnc: null }
		});
		// The partial unique index refuses a competing verified claim without revealing its owner.
		await tx.foundationAccountChannel.updateMany({
			where: { id: c.id },
			data: { status: 'VERIFIED' }
		});
		return 'VERIFIED';
	});
}
export async function revokeAccountChannel(locals: Actor, id: string) {
	return scope(locals, async (tx) => {
		await channel(tx, id);
		await cancel(tx, id);
		await tx.foundationAccountChannelVerification.updateMany({
			where: { channelId: id, revokedAt: null },
			data: { revokedAt: new Date(), revokeReason: 'OWNER_REVOKED' }
		});
		await tx.foundationAccountChannel.updateMany({
			where: { id },
			data: { status: 'REVOKED', generation: { increment: 1 } }
		});
	});
}
// Explicit removal is account-owned; vault-only privacy erasure deliberately retains these records.
export async function eraseRevokedAccountChannel(locals: Actor, id: string) {
	return scope(locals, async (tx) => {
		const c = await channel(tx, id);
		if (c.status !== 'REVOKED') throw new FoundationDenied();
		const challenges = await tx.foundationAccountChannelChallenge.findMany({
			where: { channelId: id },
			select: { id: true }
		});
		for (const ch of challenges)
			await tx.foundationAccountChannelDispatch.deleteMany({ where: { challengeId: ch.id } });
		await tx.foundationAccountChannelChallenge.deleteMany({ where: { channelId: id } });
		await tx.foundationAccountChannelVerification.deleteMany({ where: { channelId: id } });
		await tx.foundationAccountChannel.deleteMany({ where: { id } });
	});
}

// Offline privacy adapter. Caller must already hold global exchange and account/root locks.
// Suspension cancels pending delivery, retaining previously verified account assurance/history.
export async function maintainAccountChannelDelivery(
	tx: AppTransactionClient,
	ownerUserId: string,
	suspend = false
) {
	return runFoundationBoundary({ ownerUserId, mode: 'ACCOUNT_CHANNEL' }, async () => {
		await expire(tx);
		if (suspend) {
			const channels = await tx.foundationAccountChannel.findMany({ select: { id: true } });
			for (const c of channels) await cancel(tx, c.id);
		}
	});
}
