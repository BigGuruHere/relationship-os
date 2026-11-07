import { budget } from './exchangeBudget';
import { emailVerificationConfigured } from '$lib/server/integrations/resend/verification';
import { ensureSubmittedChannel, currentSubmittedProof } from './accountChannels';
import { ExchangeDenied } from './exchangeDiagnostics';
// Server-only claim service. Route callers supply authenticated locals and server-resolved client address.
import { randomInt, randomUUID } from 'node:crypto';
import { encrypt, decrypt } from '$lib/crypto';
import { prisma } from '$lib/db';
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
import { devPilotEnabled, exchangeBrowserEnabled } from './devPilotGate';

type Actor = Pick<App.Locals, 'user' | 'sessionId' | 'env' | 'appOrigin'>;
type Root = { ownerUserId: string; vaultId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function lookup(tx: AppTransactionClient, continuation: string) {
	if (!/^[0-9a-f]{64}$/.test(continuation)) throw new ExchangeDenied('CONTINUATION_INVALID');
	const rows = await tx.foundationExchange.findMany({
		where: { continuationHash: claimMac(continuation, 'lookup') },
		select: { id: true, ownerUserId: true, vaultId: true },
		take: 1
	});
	if (!rows[0]) throw new ExchangeDenied('EXCHANGE_NOT_FOUND');
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
		if (located.ownerUserId === actor.accountId) throw new ExchangeDenied('SELF_EXCHANGE');
		const roots = await exchangeRoots(tx, [located.ownerUserId, actor.accountId]);
		return exchangeScope(located, async () => {
			const exchange = await tx.foundationExchange.findFirst({ where: { id: located.id } });
			if (!exchange) throw new ExchangeDenied('EXCHANGE_NOT_FOUND');
			if (exchange.beneficiaryUserId && exchange.beneficiaryUserId !== actor.accountId)
				throw new ExchangeDenied('EXCHANGE_ACCOUNT_MISMATCH');
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
			if (!profile) throw new ExchangeDenied('PROFILE_UNPUBLISHED');
			if (!person) throw new ExchangeDenied('CONTACT_INACTIVE');
			if (!['PENDING', 'BOUND', 'SETTLED'].includes(exchange.status))
				throw new ExchangeDenied('EXCHANGE_INACTIVE');
			if (exchange.status !== 'SETTLED' && exchange.expiresAt.getTime() <= Date.now())
				throw new ExchangeDenied('EXCHANGE_EXPIRED');

			return fn(tx, exchange, actor, roots.get(actor.accountId)!);
		});
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
			if (retry.sessionHash !== sessionHash || retry.status !== 'PENDING')
				throw new ExchangeDenied('CHALLENGE_INVALID');
			if (retry.expiresAt.getTime() <= Date.now()) throw new ExchangeDenied('CHALLENGE_EXPIRED');

			return { status: 'QUEUED' as const, challengeId: retry.id };
		}
		if (e.failedAttempts >= 5 || e.sendCount >= 5) throw new ExchangeDenied('ATTEMPT_LIMIT');
		if (!e.destinationEnc) throw new ExchangeDenied('DESTINATION_UNAVAILABLE');
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
			throw new ExchangeDenied('CHALLENGE_INVALID');
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
		// Compare canonical destinations; harmless whitespace/local AU notation in configuration is accepted.
		let allowed: string[];
		try {
			allowed = (process.env.RELISH_EXCHANGE_TEST_PHONES ?? '')
				.split(',')
				.map((x) => x.trim())
				.filter(Boolean)
				.map(verificationPhone);
		} catch {
			throw new ExchangeDenied('TEST_PHONE_CONFIG_INVALID');
		}
		// Pilot sends require the existing exact DEV target/origin guard and an explicit destination allowlist.
		if (!devPilotEnabled(locals, locals.appOrigin)) throw new ExchangeDenied('DEV_TARGET_DISABLED');
		if (!allowed.includes(phone)) throw new ExchangeDenied('DESTINATION_NOT_ALLOWED');
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
	exchangeRef: string, method = 'SMS'
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
			channel: method,
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
		const result = await settleClaim(tx,e,actor.accountId,recipient,channelHash,'SMS');
		const personId=result.personId;
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

// S-405b: preview capabilities bind both exact projections, the persisted session and browser.
// They authorise a one-off profile snapshot, never channel assurance or publication.
const exchangeProfileSelect = {
	id: true,
	userId: true,
	label: true,
	displayName: true,
	emailPublic: true,
	phonePublic: true
} as const;
export async function ownedExchangeChoices(locals: Actor, targetId: string, browser: string) {
	if (!locals.user?.id || !locals.sessionId || !exchangeBrowserEnabled(locals, locals.appOrigin))
		throw new FoundationDenied();
	const target = await prisma.profile.findFirst({
		where: { id: targetId, isPublished: true },
		select: exchangeProfileSelect
	});
	if (!target || target.userId === locals.user.id) throw new FoundationDenied();
	const profiles = await prisma.profile.findMany({
		where: { userId: locals.user.id },
		orderBy: { updatedAt: 'desc' },
		take: 100,
		select: exchangeProfileSelect
	});
	return profiles.map((p) => ({
		id: p.id,
		label: p.label || p.displayName || 'My profile',
		...card(p),
		confirmation: encrypt(
			JSON.stringify({
				version: 1,
				id: randomUUID(),
				actor: locals.user!.id,
				session: locals.sessionId,
				browser,
				targetId,
				profileId: p.id,
				targetMac: cardMac(target),
				profileMac: cardMac(p),
				at: Date.now()
			}),
			'exchange.profile.preview.v1'
		)
	}));
}
function card(p: {
	displayName: string | null;
	emailPublic: string | null;
	phonePublic: string | null;
}) {
	return { name: p.displayName || '', email: p.emailPublic || '', phone: p.phonePublic || '' };
}
function cardMac(p: Parameters<typeof card>[0]) {
	return claimMac(JSON.stringify(card(p)), 'profile-preview');
}

export async function confirmOwnedProfileExchange(
	locals: Actor,
	token: string,
	browser: string,
	targetId: string
) {
	if (!locals.user?.id || !exchangeBrowserEnabled(locals, locals.appOrigin) || token.length > 5000)
		throw new FoundationDenied();
	if(token.split(':').length!==3 || token.split(':').some(part=>Buffer.from(part,'base64').toString('base64')!==part)) throw new FoundationDenied();
	const preview = JSON.parse(decrypt(token, 'exchange.profile.preview.v1'));
	if (
		preview.targetId !== targetId ||
		preview.version !== 1 ||
		preview.actor !== locals.user.id ||
		preview.session !== locals.sessionId ||
		!browser ||
		preview.browser !== browser ||
		!uuid.test(preview.id) ||
		!Number.isFinite(preview.at) ||
		preview.at > Date.now() ||
		Date.now() - preview.at >= 1800000
	)
		throw new FoundationDenied();
	return exchangeTransaction(locals.user.id, async (tx) => {
		const actor = await requireClaimSession(tx, locals);
		const target = await tx.profile.findFirst({
			where: { id: preview.targetId, isPublished: true },
			select: exchangeProfileSelect
		});
		if (!target || target.userId === actor.accountId) throw new FoundationDenied();
		const roots = await exchangeRoots(tx, [target.userId, actor.accountId]);
		// Lock both profiles in deterministic order before validating the exact previewed projection.
		for (const id of [preview.targetId, preview.profileId].sort())
			await tx.$queryRaw`SELECT "id" FROM "Profile" WHERE "id" = ${id} FOR UPDATE`;
		const selected = await tx.profile.findFirst({
			where: { id: preview.profileId, userId: actor.accountId },
			select: exchangeProfileSelect
		});
		const current = await tx.profile.findFirst({
			where: { id: preview.targetId, userId: target.userId, isPublished: true },
			select: exchangeProfileSelect
		});
		if (
			!selected ||
			!current ||
			!card(selected).name ||
			!card(current).name ||
			cardMac(selected) !== preview.profileMac ||
			cardMac(current) !== preview.targetMac
		)
			throw new FoundationDenied();
		const origin = roots.get(target.userId)!,
			recipient = roots.get(actor.accountId)!;
		return exchangeScope(origin, async () => {
			const prior = await tx.foundationExchange.findFirst({ where: { id: preview.id } });
			if (prior) {
				if (prior.beneficiaryUserId !== actor.accountId || prior.status !== 'SETTLED')
					throw new FoundationDenied();
				// Archived/revoked entries never revive through retry.
				for (const root of [origin, recipient])
					await exchangeScope(root, async () => {
						const link = await tx.foundationAccountAssociation.findFirst({
							where: {
								accountId: root === origin ? actor.accountId : target.userId,
								state: 'ACTIVE'
							}
						});
						if (
							!link ||
							!(await tx.foundationSubject.findFirst({
								where: { id: link.subjectId, state: 'ACTIVE' }
							}))
						)
							throw new FoundationDenied();
					});
				return { status: 'SETTLED' as const, personId: prior.settledSubjectId };
			}
			if (
				!(await budget(tx, actor.accountId, [
					['profile:account:' + actor.accountId, 100],
					['profile:target:' + target.id, 100]
				]))
			)
				throw new FoundationDenied();
			// Reuse the same private person/evidence writers for each direction. PROFILE is explicit
			// account ownership authority and intentionally asserts no verified phone/email.
			const originPerson = await saveProfileSide(tx, origin, actor.accountId, selected, preview.id);
			const recipientPerson = await exchangeScope(recipient, () =>
				saveProfileSide(tx, recipient, target.userId, current, preview.id)
			);
			await tx.foundationExchange.create({
				data: {
					...origin,
					id: preview.id,
					profileId: target.id,
					subjectId: originPerson.personId,
					sourceId: originPerson.sourceId,
					snapshotEnc: seal('FoundationExchange', 'snapshotEnc', origin, preview.id, card(current)),
					continuationHash: claimMac(preview.id, 'profile-confirmation'),
					beneficiaryUserId: actor.accountId,
					status: 'SETTLED',
					settledSubjectId: recipientPerson.personId,
					settledVaultId: recipient.vaultId,
					expiresAt: new Date(Date.now() + 86400000)
				}
			});
			return { status: 'SETTLED' as const, personId: recipientPerson.personId };
		});
	});
}
async function saveProfileSide(
	tx: AppTransactionClient,
	root: Root,
	accountId: string,
	profile: Parameters<typeof card>[0] & { id: string },
	exchangeId: string
) {
	const prior = await tx.foundationAccountAssociation.findFirst({ where: { accountId } });
	let personId = prior?.subjectId;
	if (
		prior &&
		(prior.state !== 'ACTIVE' ||
			!(await tx.foundationSubject.findFirst({ where: { id: prior.subjectId, state: 'ACTIVE' } })))
	)
		throw new FoundationDenied();
	if (!personId) {
		const person = await insertPrivatePerson(tx, root, card(profile), {
			submittedAt: new Date().toISOString(),
			profileId: profile.id,
			sourceId: exchangeId
		});
		personId = person.id;
		await tx.foundationAccountAssociation.create({
			data: {
				...root,
				subjectId: personId,
				accountId,
				channel: 'PROFILE',
				channelHash: '',
				verifiedAt: new Date(),
				exchangeRef: exchangeId
			}
		});
	}
	const sourceId = await insertExchangeReceipt(
		tx,
		root,
		personId,
		card(profile),
		exchangeId,
		profile.id
	);
	return { personId, sourceId };
}

// Common settlement preserves source IDs/history and copies only the selected public card.
async function settleClaim(tx:AppTransactionClient,e:FoundationExchange,accountId:string,recipient:Root,channelHash:string,method='SMS') {
		const existing = await tx.foundationAccountAssociation.findFirst({
			where: { accountId: accountId }
		});
		if (existing && existing.subjectId !== e.subjectId) throw new FoundationDenied();
		await association(tx, e, accountId, e.subjectId, channelHash, e.id, method);
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
 await tx.foundationExchange.updateMany({where:{id:e.id},data:{beneficiaryUserId:accountId,status:'SETTLED',settledSubjectId:personId,settledVaultId:recipient.vaultId}});
 return {status:'SETTLED' as const,personId};
}

function submittedChannels(e:FoundationExchange):{type:'PHONE'|'EMAIL';value:string}[]{
 if(e.claimVersion!==2 || !e.submittedChannelsEnc) throw new FoundationDenied();
 return open('FoundationExchange','submittedChannelsEnc',e,e.id,e.submittedChannelsEnc);
}
export async function accountClaimState(locals:Actor,token:string){
 return withClaim(locals,token,async(tx,e,actor)=>{
  const channels=submittedChannels(e);const statuses=[];
  for(const c of channels){const proof=await currentSubmittedProof(tx,actor.accountId,c.type,c.value);
   statuses.push({type:c.type,verified:Boolean(proof),available:c.type==='PHONE' || emailVerificationConfigured(),masked:c.type==='PHONE'?'•••• '+c.value.slice(-4):c.value[0]+'•••@'+c.value.split('@')[1]});}
  return {settled:e.status==='SETTLED',channels:statuses,canComplete:statuses.some(c=>c.verified)};
 });
}
// Bind a new exact submission before requesting a channel check; destination is never read from a form.
export async function prepareAccountClaim(locals:Actor,token:string,type:string){
 return withClaim(locals,token,async(tx,e,actor)=>{
  const channels=submittedChannels(e);const selected=channels.find(c=>c.type===type);
  if(!selected) throw new FoundationDenied();
  await tx.foundationExchange.updateMany({where:{id:e.id},data:{beneficiaryUserId:actor.accountId,status:e.status==='SETTLED'?'SETTLED':'BOUND'}});
  let selectedId='';for(const c of channels){const saved=await ensureSubmittedChannel(tx,actor.accountId,c.type,c.value);if(c.type===type) selectedId=saved.id;}
  return selectedId;
 });
}
export async function completeAccountClaim(locals:Actor,token:string){
 return withClaim(locals,token,async(tx,e,actor,recipient)=>{
  const channels=submittedChannels(e);let verified:{type:string;value:string}|undefined;
  // Resolve current proof within the same global/account locks used by revocation and settlement.
  for(const c of channels) if(await currentSubmittedProof(tx,actor.accountId,c.type,c.value)){verified=c;break;}
  if(!verified) throw new FoundationDenied();
  if(e.status==='SETTLED') return {status:'SETTLED' as const,personId:e.settledSubjectId};
  for(const c of channels) await ensureSubmittedChannel(tx,actor.accountId,c.type,c.value);
  return settleClaim(tx,e,actor.accountId,recipient,claimMac(verified.type+':'+verified.value,'channel'),'ACCOUNT_CHANNEL');
 });
}
