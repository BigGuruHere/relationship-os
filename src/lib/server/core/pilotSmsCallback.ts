// Stage 8.18: single-use QR -> signed SMS -> provisional telephone identity -> outbound SIP.
// A scan alone never triggers a callback. SMS source is a recognition hint, not login proof.
import { createHash, randomBytes } from 'node:crypto';
import { conversationalPolicyEnabled, currentRelishPolicy, policyInstructionForCaller, withConsentGate } from './relishCallPolicy';
import { prisma } from '$lib/db';
import { encrypt, buildScopedIndexToken } from '$lib/crypto';
import { ensureProvisionalPhoneCaller } from '$lib/server/integrations/elevenlabs/phoneOnboarding';
import { establishPhoneDefaultFromInvitation } from '$lib/server/integrations/elevenlabs/phoneDefaultContext';
import { ensurePilotSelfContact, pilotDomainForKind, recordPilotEvent, type PilotDomain } from '$lib/server/pilot';
import { startSharedNetworkSession } from '$lib/server/integrations/elevenlabs/networkSession';
import { normalizePhoneForIdentity } from '$lib/server/integrations/elevenlabs/phone';
import { sendTelnyxSms } from '$lib/server/integrations/telnyx/messaging';

// Stage 8.18a - Privacy-safe, structured diagnostics for the SMS callback pipeline.
// Only record correlation IDs, stage names, environment and short internal error codes.
// Never log SMS text, invitation codes, phone numbers, encrypted fields, session tokens or LU.
type SmsDiagnostic = {
  requestId?: string;
  invitationId?: string;
  environment?: string;
  domainKey?: string;
  reason?: string;
  eventId?: string;
  providerStatus?: number;
  stage?: string;
};
export function logPilotSmsCallback(action: string, details: SmsDiagnostic = {}, level: 'info' | 'warn' | 'error' = 'info') {
  const line = JSON.stringify({ component: 'pilot-sms', action, ...details });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export const smsCallEnabled = () => process.env.RELISH_PILOT_SMS_CALLBACK_ENABLED === 'YES';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const index = (phone: string) => buildScopedIndexToken(phone, 'network:provisional-phone:v1');
const expirationMinutes = 20;

export function pilotTermsConfig() {
  const policy = currentRelishPolicy();
  return { ...policy, ready: Boolean(smsCallEnabled() && conversationalPolicyEnabled() &&
    policy.valid &&
    /^\+[1-9]\d{7,14}$/.test(process.env.RELISH_DORIAN_SMS_NUMBER || '') &&
    process.env.TELNYX_API_KEY && process.env.TELNYX_PUBLIC_KEY && process.env.ELEVENLABS_API_KEY &&
    process.env.ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID && process.env.RELISH_NETWORK_DORIAN_BINDING_ID) };
}

export async function issuePilotSmsInvitation(input: { profileId: string; ownerUserId: string;
  domainKey: PilotDomain; env: string; source: string; offeredName?: string; offeredEmail?: string }) {
  const cfg = pilotTermsConfig();
  if (!cfg.ready) throw new Error('SMS_CALL_NOT_CONFIGURED: Check APP_ORIGIN, RELISH_LEGAL_DOCUMENTS_PUBLISHED, RELISH_PILOT_TERMS_VERSION, callback/consent flags and ElevenLabs/Telnyx configuration.');
  // Generate an 80-bit base32 invitation (16 letters/digits), without exposing the profile ID.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from(randomBytes(16), (byte) => alphabet[byte & 31]).join('');
  // Opportunistic 30-day data minimisation for short-lived SMS invitations.
  // In production also arrange scheduled retention cleanup if no new invitations arrive.
  await prisma.pilotSmsInvitation.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400000) } } });
  const row = await prisma.pilotSmsInvitation.create({ data: {
    codeHash: sha(code), profileId: input.profileId, ownerUserId: input.ownerUserId,
    domainKey: input.domainKey, environment: input.env, source: input.source,
    termsVersion: cfg.version, expiresAt: new Date(Date.now() + expirationMinutes * 60000),
    ...(input.offeredName && input.offeredEmail ? {
      offeredNameEnc: encrypt(input.offeredName, 'pilot.connection.name'),
      offeredEmailEnc: encrypt(input.offeredEmail, 'pilot.connection.email'),
      connectionConsentAt: new Date()
    } : {})
  }, select: { id: true } });
  logPilotSmsCallback('invitation.issued', { invitationId: row.id, environment: input.env, domainKey: input.domainKey });
  await recordPilotEvent({ type: 'sms.invitation_created', env: input.env, profileId: input.profileId,
    ownerUserId: input.ownerUserId, domainKey: input.domainKey, source: input.source,
    dedup: 'sms.invite:' + row.id });
  return { smsTo: process.env.RELISH_DORIAN_SMS_NUMBER!, smsText: `Hi Dorian, call me! (ref ${code})`, expiresMinutes: expirationMinutes };
}

const quietReply = 'Dorian could not start that call. Please open the profile again for a new invitation.';

export async function consumePilotSmsForCallback(input: { messageId: string; from: unknown; to: unknown;
  body: unknown; environment: string; requestId?: string }) {
  const trace = (action: string, reason?: string, invitationId?: string, level: 'info' | 'warn' | 'error' = 'info', stage?: string) =>
    logPilotSmsCallback(action, { requestId: input.requestId, environment: input.environment, ...(invitationId ? { invitationId } : {}),
      ...(reason ? { reason } : {}), ...(stage ? { stage } : {}) }, level);
  if (!smsCallEnabled()) { trace('sms.skipped', 'FEATURE_DISABLED'); return 'disabled'; }
  const phone = normalizePhoneForIdentity(input.from);
  const destination = normalizePhoneForIdentity(input.to);
  if (!phone || !destination || destination !== normalizePhoneForIdentity(process.env.RELISH_DORIAN_SMS_NUMBER)) {
    trace('sms.skipped', 'INVALID_SENDER_OR_DESTINATION');
    return 'ignored';
  }
  const text = String(input.body || '').trim();
  const phoneIdx = index(phone);
  // Honor SMS opt-outs across every profile. Neither STOP nor START triggers a call.
  if (/^(STOP|UNSUBSCRIBE|CANCEL|QUIT)$/i.test(text)) {
    trace('sms.opt_out');
    await prisma.pilotSmsOptOut.upsert({ where: { phoneIndex: phoneIdx },
      update: { optedOutAt: new Date(), resumedAt: null },
      create: { phoneIndex: phoneIdx } });
    return 'opted_out';
  }
  if (/^START$/i.test(text)) {
    trace('sms.opt_in');
    await prisma.pilotSmsOptOut.updateMany({ where: { phoneIndex: phoneIdx }, data: { resumedAt: new Date() } });
    return 'resumed';
  }
  // Recognise friendly invitations and previously issued Stage 8.18 codes during rollout.
  const match = /^Hi Dorian,\s*call me!\s*\(ref ([A-HJ-NP-Z2-9]{16})\)$/i.exec(text) || /^CALL\s+([0-9A-F]{20})$/i.exec(text);
  if (!match) { trace('sms.skipped', 'UNRECOGNISED_SMS_COMMAND'); return 'ignored'; }
  if (!/^[\w-]{8,160}$/.test(input.messageId)) { trace('sms.skipped', 'INVALID_MESSAGE_ID'); return 'ignored'; }
  const optOut = await prisma.pilotSmsOptOut.findUnique({ where: { phoneIndex: phoneIdx } });
  if (optOut && !optOut.resumedAt) { trace('sms.skipped', 'NUMBER_OPTED_OUT'); return 'opted_out'; }
  const invitation = await prisma.pilotSmsInvitation.findUnique({ where: { codeHash: sha(match[1].toUpperCase()) } });
  // Keep the public webhook result generic while logging the actual safe failure reason.
  if (!invitation) { trace('invitation.rejected', 'UNKNOWN_CODE'); return 'expired'; }
  if (invitation.environment !== input.environment) {
    trace('invitation.rejected', 'ENVIRONMENT_MISMATCH', invitation.id, 'warn');
    return 'expired';
  }
  if (invitation.expiresAt < new Date()) { trace('invitation.rejected', 'INVITATION_EXPIRED', invitation.id); return 'expired'; }
  // Atomic one-shot claim prevents a replayed or parallel webhook from starting another call.
  const claimed = await prisma.pilotSmsInvitation.updateMany({ where: { id: invitation.id, status: 'ISSUED' },
    data: { status: 'CLAIMED', telnyxMessageId: input.messageId, phoneIndex: index(phone), callAttemptedAt: new Date() } });
  if (claimed.count !== 1) { trace('invitation.rejected', 'ALREADY_CLAIMED', invitation.id); return 'duplicate'; }
  trace('invitation.claimed', undefined, invitation.id);
  const fail = async (reason: string) => {
    trace('callback.failed', reason, invitation.id, 'warn');
    await prisma.pilotSmsInvitation.update({ where: { id: invitation.id }, data: { status: 'FAILED', lastErrorCode: reason.slice(0, 60) } });
    try { await sendTelnyxSms(phone, quietReply); } catch { /* Do not mask failure or repeat call. */ }
    return 'failed';
  };
  let processingStage = 'PROFILE_LOOKUP';
  try {
    const profile = await prisma.profile.findFirst({ where: { id: invitation.profileId,
      userId: invitation.ownerUserId, isPublished: true }, select: { id: true, displayName: true, kind: true } });
    if (!profile || pilotDomainForKind(profile.kind) !== invitation.domainKey) return fail('PROFILE_UNAVAILABLE');
    processingStage = 'PREFERENCE_LOOKUP';
    const preference = await prisma.relishContextPreference.findUnique({ where: {
      ownerUserId_domainKey: { ownerUserId: invitation.ownerUserId, domainKey: invitation.domainKey }
    } });
    if (preference?.dorianMode === 'BROWSER') return fail('MODE_CHANGED');
    // 3 callback requests per sender in a rolling day (including failed calls).
    processingStage = 'RATE_LIMIT_CHECK';
    const attempts = await prisma.pilotSmsInvitation.count({ where: {
      phoneIndex: index(phone), callAttemptedAt: { gte: new Date(Date.now() - 86400000) }
    } });
    if (attempts > 3) return fail('RATE_LIMIT');
    processingStage = 'PROVISIONAL_CALLER';
    const caller = await ensureProvisionalPhoneCaller(phone, invitation.domainKey as PilotDomain);
    if (!caller || caller.userId === invitation.ownerUserId) return fail('CALLER_UNAVAILABLE');
    processingStage = 'CONTEXT_SETUP';
    const { contextSpaceId } = await ensurePilotSelfContact(caller.userId, invitation.domainKey as PilotDomain);
    // The first valid QR context becomes the long-term starting point unless the
    // provisional caller already chose a default or had earlier phone conversations.
    const selectedDefault = await establishPhoneDefaultFromInvitation(caller, contextSpaceId);
    if (!selectedDefault) return fail('DEFAULT_CONTEXT_UNAVAILABLE');
    trace('default_context.ready', undefined, invitation.id);
    // SMS invitation and the participant's private ContextSpace share a person, not owner custody.
    processingStage = 'PROFILE_ENTRY';
    const entry = await prisma.pilotProfileEntry.create({ data: {
      profileId: profile.id, ownerUserId: invitation.ownerUserId,
      visitorUserId: caller.userId, domainKey: invitation.domainKey,
      environment: invitation.environment, entrySource: 'sms'
    }, select: { id: true } });
    await prisma.pilotSmsInvitation.update({ where: { id: invitation.id }, data: {
      participantUserId: caller.userId, pilotEntryId: entry.id
    } });
    await recordPilotEvent({ type: 'sms.invitation_received', env: invitation.environment, profileId: profile.id,
      ownerUserId: invitation.ownerUserId, domainKey: invitation.domainKey as PilotDomain,
      entryId: entry.id, visitorUserId: caller.userId, source: 'sms', dedup: 'sms.received:' + invitation.id });
    // Sharing name/email is separately opt-in. Automatic acceptance is configurable per context.
    processingStage = 'CONNECTION_REQUEST';
    if (invitation.connectionConsentAt && invitation.offeredNameEnc && invitation.offeredEmailEnc) {
      await prisma.pilotConnectionRequest.create({ data: {
        entryId: entry.id, profileId: profile.id, ownerUserId: invitation.ownerUserId,
        visitorUserId: caller.userId, domainKey: invitation.domainKey,
        nameEnc: invitation.offeredNameEnc, emailEnc: invitation.offeredEmailEnc,
        status: preference?.connectionMode === 'APPROVAL' ? 'REQUESTED' : 'ACCEPTED'
      } });
      await recordPilotEvent({ type: 'relationship.connection_requested', env: invitation.environment,
        profileId: profile.id, ownerUserId: invitation.ownerUserId, domainKey: invitation.domainKey as PilotDomain,
        entryId: entry.id, visitorUserId: caller.userId, source: 'sms', dedup: 'sms.connect:' + entry.id });
      if (preference?.connectionMode !== 'APPROVAL') await recordPilotEvent({ type: 'relationship.connection_accepted',
        env: invitation.environment, profileId: profile.id, ownerUserId: invitation.ownerUserId,
        domainKey: invitation.domainKey as PilotDomain, entryId: entry.id,
        visitorUserId: caller.userId, source: 'sms', dedup: 'sms.accept:' + entry.id });
    }
    // SMS requests a call but does NOT establish consent to policy, recording or data sharing.
    // Dorian must obtain explicit affirmative acceptance via a session-bound tool.
    const cfg = pilotTermsConfig();
    // Invitation and effective policy must match: never send newer terms under an old version.
    if (invitation.termsVersion !== cfg.version) return fail('POLICY_CHANGED_REISSUE');
    processingStage = 'TERMS_SMS';
    trace('terms_sms.requested', undefined, invitation.id);
    try {
      await sendTelnyxSms(phone, `Dorian (Relish AI) will call shortly. Please read our Terms and Privacy information (${invitation.termsVersion}): ${cfg.legalUrl} Dorian will ask for your agreement before chatting. Calls may be recorded/transcribed and privately processed if you agree. Reply STOP to opt out of texts.`);
    } catch (error) {
      // Preserve the status code, when available, without emitting provider bodies or credentials.
      const safeCode = error instanceof Error && /^TELNYX_SMS_HTTP_\d{3}$/.test(error.message)
        ? error.message : 'TELNYX_TERMS_SMS_FAILED';
      return fail(safeCode);
    }
    trace('terms_sms.accepted', undefined, invitation.id);
    processingStage = 'PRIVATE_SESSION';
    trace('session.requested', undefined, invitation.id);
    const session = await startSharedNetworkSession(caller.userId, contextSpaceId, {
      pilotEntryId: entry.id, domainKey: invitation.domainKey as PilotDomain,
      profileName: profile.displayName || '', profileKind: profile.kind
    });
    if (!session || session.status !== 'READY') return fail('PRIVATE_SESSION_UNAVAILABLE');
    trace('session.ready', undefined, invitation.id);
    const dynamicVariables = JSON.parse(session.dynamicVariables);
    const policy = await policyInstructionForCaller(caller.userId);
    // Outbound calls do not run initiation webhooks if client data is supplied. The opaque
    // Relish session binds post-call ingestion to the exact participant and context.
    Object.assign(dynamicVariables, {
      call_type: 'SMS_INVITED_OUTBOUND',
      agent_website: '', agent_type: 'DORIAN', emotion_label: '',
      living_understanding: dynamicVariables.relish_living_understanding || '',
      living_understanding_revision: dynamicVariables.relish_living_understanding_revision || '',
      call_instruction: `${dynamicVariables.call_instruction} This call was requested through a signed SMS invitation. Introduce yourself as Dorian, the participant's AI networking partner. Do not lead with the inviter or profile category. Be warm, interested in what matters to this person and what they enjoy contributing to others. Do not suggest network introductions are already available. Verify identity before relying on provisional phone memories.`
    });
    processingStage = 'ELEVENLABS_REQUEST';
    trace('elevenlabs.requested', undefined, invitation.id);
    const apiResult = await fetch('https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call', {
      method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: session.agentId,
        agent_phone_number_id: process.env.ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID,
        to_number: phone, conversation_initiation_client_data: { dynamic_variables: withConsentGate(dynamicVariables, policy) } }),
      signal: AbortSignal.timeout(20000)
    });
    if (!apiResult.ok) {
      logPilotSmsCallback('elevenlabs.rejected', { requestId: input.requestId, invitationId: invitation.id,
        environment: input.environment, providerStatus: apiResult.status }, 'warn');
      return fail(`ELEVENLABS_HTTP_${apiResult.status}`);
    }
    trace('elevenlabs.accepted', undefined, invitation.id);
    const sent = await apiResult.json();
    if (!sent.success || !/^conv_[A-Za-z0-9_-]{8,100}$/.test(sent.conversation_id || ''))
      return fail('ELEVENLABS_NO_CONVERSATION');
    processingStage = 'CALL_PERSISTENCE';
    await prisma.networkDorianSession.updateMany({ where: { id: session.sessionId, conversationId: null },
      data: { conversationId: sent.conversation_id } });
    await prisma.pilotSmsInvitation.update({ where: { id: invitation.id }, data: {
      status: 'CALLING', conversationId: sent.conversation_id
    } });
    processingStage = 'CALL_EVENT';
    await recordPilotEvent({ type: 'dorian.callback_requested', env: invitation.environment, profileId: profile.id,
      ownerUserId: invitation.ownerUserId, domainKey: invitation.domainKey as PilotDomain,
      entryId: entry.id, visitorUserId: caller.userId, conversationId: sent.conversation_id,
      source: 'sms', dedup: 'sms.callback:' + invitation.id });
    trace('callback.calling', undefined, invitation.id);
    return 'calling';
  } catch (_error) {
    // Preserve the failed processing stage without logging a sensitive exception message.
    return fail(`PROCESSING_${processingStage}`);
  }
}
