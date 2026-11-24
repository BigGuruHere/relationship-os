import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/db';
import {
	callerHasAcceptedCurrentTerms, conversationalPolicyEnabled, currentRelishPolicy,
	instructionForKnownPolicyStatus, savePolicyAcceptance, withConsentGate
} from '$lib/server/core/relishCallPolicy';
import { enqueueCurrentPolicySms, kickQueuedPolicySms } from '$lib/server/core/relishPolicySms';
import { safeFirstMessage } from '$lib/server/integrations/elevenlabs/dorianControlPlane';
import { verificationPhone, claimMac, sameMac } from './exchangeCrypto';
import { dorianTelephoneMobile, resolveDorianTelephoneCaller } from './accountChannels';
import { dorianConsentVersion, dorianPhoneFirstEnabled, dorianProcessingMessage, dorianProviderWindowMs, foundationDorianPhoneAgent } from './dorianCallConfig';
import { dorianCallProcessing, prepareDorianCall } from './dorianCalls';
import { FoundationDenied } from './internal';
import { withDorianTelephoneAccount } from './policy';

const conversationPattern = /^conv_[a-z0-9_-]{1,235}$/i;
const registrationDelayMs = 20_000;

function phoneEnvelope(firstMessage: string, dynamicVariables: Record<string, unknown>) {
	return { type: 'conversation_initiation_client_data', dynamic_variables: dynamicVariables,
		conversation_config_override: { agent: { first_message: firstMessage } } };
}

function closedPhoneCall(firstMessage: string, processing: boolean) {
	return {
		mode: processing ? 'PROCESSING_ONLY' as const : 'UNRESOLVED' as const,
		payload: phoneEnvelope(firstMessage, {
			relish_network_session: processing ? 'PROCESSING_NO_SESSION' : 'UNRESOLVED_NO_SESSION',
			relish_identity_status: processing ? 'PROCESSING' : 'UNRESOLVED',
			terms_agreed: false,
			call_instruction: 'After the first message, invoke the built-in end_call tool. Do not ask questions or invoke Relish tools.'
		})
	};
}

function sessionMac(call: { id: string; conversationId: string; agentId: string }) {
	return claimMac(JSON.stringify([call.id, call.conversationId, call.agentId]), 'dorian-telephone-session');
}

// The authenticated inbound route supplies the provider's caller ID and resolved agent.
// Incoming caller ID grants session-scoped Dorian continuity. The opted-in
// phone-first pilot can create an account without granting browser sign-in.
export async function startFoundationTelephoneCall(input: {
	agentId: string; callerId: unknown; conversationId: unknown; development: boolean;
}) {
	if (input.agentId !== foundationDorianPhoneAgent()) return null;
	const phoneFirst = dorianPhoneFirstEnabled();
	const unavailable = () => closedPhoneCall('Dorian is temporarily unavailable. Please try again shortly.', false);
	if (typeof input.conversationId !== 'string' || !conversationPattern.test(input.conversationId))
		return phoneFirst ? unavailable() : null;
	const conversationId = input.conversationId;
	const policy = currentRelishPolicy();
	const policyAvailable = policy.valid && conversationalPolicyEnabled();
	if (phoneFirst && !policyAvailable) return unavailable();
	try {
		const channel = await resolveDorianTelephoneCaller(input.callerId);
		if (!channel) return phoneFirst
			? closedPhoneCall('Please call back from an Australian mobile with caller ID enabled.', false)
			: null;
		if (!policyAvailable) return unavailable();
		const { ownerUserId } = channel;
		const admission = await withDorianTelephoneAccount(ownerUserId, async (tx, root) => {
			const phone = await dorianTelephoneMobile(tx, ownerUserId, channel.id, channel.generation);
			if (!phone || channel.phone !== phone)
				throw new FoundationDenied();
			const known = await tx.dorianFoundationCall.findUnique({ where: { conversationId } });
			if (known && (known.ownerUserId !== ownerUserId || known.vaultId !== root.vaultId ||
				known.epoch !== root.epoch || known.agentId !== input.agentId || known.phoneChannelId !== channel.id ||
				known.phoneChannelGeneration !== channel.generation || known.phonePolicyVersion !== policy.version ||
				!['AWAITING_TERMS', 'QUEUED'].includes(known.state) ||
				Date.now() - known.createdAt.getTime() >= dorianProviderWindowMs)) throw new FoundationDenied();
			if (!known && await dorianCallProcessing(tx, ownerUserId, root.vaultId, root.epoch)) return null;
			const accepted = await callerHasAcceptedCurrentTerms(ownerUserId, policy, tx);
			const self = await tx.foundationSubject.findUnique({
				where: { selfUserId: ownerUserId }, select: { id: true }
			});
			if (!self) throw new FoundationDenied();
			const call = known ?? await tx.dorianFoundationCall.create({ data: {
				ownerUserId, ...root, subjectId: self.id, conversationId, agentId: input.agentId,
				consentVersion: dorianConsentVersion, runKey: randomUUID(), phoneChannelId: channel.id,
				phoneChannelGeneration: channel.generation, phonePolicyVersion: policy.version,
				state: accepted ? 'QUEUED' : 'AWAITING_TERMS',
				nextAttemptAt: new Date(Date.now() + registrationDelayMs)
			} });
			if (call.state === 'QUEUED' && !accepted) throw new FoundationDenied();
			return { call, phone };
		});
		if (!admission) return closedPhoneCall(dorianProcessingMessage, true);
		const { call, phone } = admission;
		const session = sessionMac(call);
		if (call.state === 'QUEUED') {
			const context = await prepareDorianCall(call.id);
			return { mode: 'PARTICIPANT' as const, payload: phoneEnvelope(context.firstMessage, {
				...context.dynamicVariables, relish_network_session: session, conversation_id: conversationId
			}) };
		}

		// Send only the legal notice. DEV delivery uses the existing test-phone allowlist.
		const mayText = !input.development || (process.env.RELISH_EXCHANGE_TEST_PHONES ?? '').split(',').some(value => {
			try { return verificationPhone(value.trim()) === phone; } catch { return false; }
		});
		const smsStatus = mayText ? await enqueueCurrentPolicySms({ userId: ownerUserId, phone, accepted: false,
			channel: { phoneChannelId: channel.id, phoneChannelGeneration: channel.generation }
		}) : 'NOT_AVAILABLE';
		if (smsStatus === 'PENDING') kickQueuedPolicySms();
		const gate = instructionForKnownPolicyStatus(false, smsStatus);
		const firstMessage = safeFirstMessage(null, gate)!;
		return { mode: 'PARTICIPANT' as const, payload: phoneEnvelope(firstMessage, withConsentGate({
			relish_network_session: session, conversation_id: conversationId,
			relish_identity_status: 'PROVISIONAL_PHONE_ACCOUNT', call_type: 'FOUNDATION_SELF_PHONE',
			call_instruction: 'On an ACCEPTED tool result, use startup_context as the approved call context and continue naturally. On PROCESSING, read the returned message and end the call.'
		}, gate)) };
	} catch (cause) {
		if (cause instanceof FoundationDenied) return unavailable();
		throw cause;
	}
}

// The legacy consent tool delegates here only for a Foundation telephone binding.
// Its session MAC is specific to the provider conversation; no tool selects an account.
export async function acceptFoundationTelephonePolicy(input: {
	token: unknown; conversationId: unknown; agreement: unknown;
}) {
	if (typeof input.conversationId !== 'string' || !conversationPattern.test(input.conversationId)) return null;
	const recorded = await prisma.dorianFoundationCall.findUnique({ where: { conversationId: input.conversationId } });
	if (!recorded?.phoneChannelId) return null;
	const unavailable = { status: 'UNAUTHORISED' as const };
	if (typeof input.token !== 'string' || recorded.agentId !== foundationDorianPhoneAgent() ||
		!sameMac(input.token, sessionMac(recorded))) return unavailable;
	if (input.agreement !== true && input.agreement !== 'yes' && input.agreement !== 'accepted')
		return { status: 'NOT_ACCEPTED' as const };
	const policy = currentRelishPolicy();
	if (!conversationalPolicyEnabled() || !policy.valid || policy.version !== recorded.phonePolicyVersion)
		return { status: 'POLICY_UNAVAILABLE' as const };
	try {
		const outcome = await withDorianTelephoneAccount(recorded.ownerUserId, async (tx, root) => {
			const call = await tx.dorianFoundationCall.findUnique({ where: { id: recorded.id } });
			if (!call?.phoneChannelId || call.phoneChannelGeneration === null ||
				root.vaultId !== call.vaultId || root.epoch !== call.epoch ||
				Date.now() - call.createdAt.getTime() >= dorianProviderWindowMs ||
				!['AWAITING_TERMS', 'QUEUED'].includes(call.state) ||
				!await dorianTelephoneMobile(tx, call.ownerUserId, call.phoneChannelId, call.phoneChannelGeneration))
				return 'UNAUTHORISED';
			if (call.state === 'QUEUED')
				return await callerHasAcceptedCurrentTerms(call.ownerUserId, policy, tx) ? 'ACCEPTED' : 'UNAUTHORISED';

			if (await dorianCallProcessing(tx, call.ownerUserId, root.vaultId, root.epoch)) return 'PROCESSING';
			// The signed end webhook can close a pending call concurrently. The
			// conditional write prevents new consent from reactivating a closed call.
			const activated = await tx.dorianFoundationCall.updateMany({
				where: { id: call.id, state: 'AWAITING_TERMS' },
				data: { state: 'QUEUED', nextAttemptAt: new Date(Date.now() + registrationDelayMs) }
			});
			if (!activated.count) return 'UNAUTHORISED';
			await savePolicyAcceptance(policy, {
				userId: call.ownerUserId, sessionId: 'foundation-phone:' + call.id,
				conversationId: call.conversationId, method: 'VOICE_EXPLICIT'
			}, tx);
			return 'ACCEPTED';
		});
		if (outcome === 'PROCESSING') return { status: outcome, message: dorianProcessingMessage };
		if (outcome === 'UNAUTHORISED') return unavailable;
		const context = await prepareDorianCall(recorded.id);
		return { status: 'ACCEPTED' as const, policy_version: policy.version, terms_agreed: true, startup_context: context.dynamicVariables };
	} catch (cause) {
		if (cause instanceof FoundationDenied) return unavailable;
		throw cause;
	}
}

// A Foundation-bound call must never fall through to the legacy transcript importer.
// The shared worker fetches the provider transcript and checks the exact call binding.
export async function finishFoundationTelephoneCall(conversationId: unknown, agentId: unknown, hasSpeech: boolean) {
	if (typeof conversationId !== 'string' || !conversationPattern.test(conversationId)) return false;
	const call = await prisma.dorianFoundationCall.findUnique({ where: { conversationId },
		select: { id: true, phoneChannelId: true, agentId: true } });
	if (!call?.phoneChannelId) return false;
	if (typeof agentId === 'string' && agentId !== call.agentId) return true;
	await prisma.dorianFoundationCall.updateMany({
		where: { id: call.id, state: hasSpeech ? 'AWAITING_TERMS' : { in: ['AWAITING_TERMS', 'QUEUED'] },
			sourceId: null, lease: null },
		data: { state: 'INCOMPLETE' }
	});
	return true;
}
