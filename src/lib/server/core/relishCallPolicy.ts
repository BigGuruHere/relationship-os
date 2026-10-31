// Stage 8.19 - A session-bound, explicit voice acceptance gate for Relish onboarding.
// A signed ElevenLabs tool must call the acceptance endpoint after the caller says yes.
// Never interpret a QR scan, SMS, silence or mere continuation as acceptance.
import { prisma } from '$lib/db';
import { activeSharedDorianBindingId, networkSessionHash, isAuthorizedSharedDorianBindingId } from '$lib/server/integrations/elevenlabs/networkSession';

export const conversationalPolicyEnabled = () => process.env.RELISH_PILOT_CONVERSATIONAL_TERMS === 'YES';

// Stage 8.19a: legal pages are bundled with the application and published on
// each deployment's APP_ORIGIN. Never use a second hosting variable or hardcoded hosts.
// URL construction is centralized so voice consent, SMS, and the visitor page
// always refer to the same documents for a given environment.
export function currentRelishPolicy() {
  const version = process.env.RELISH_PILOT_TERMS_VERSION ?? '';
  const appOrigin = process.env.APP_ORIGIN ?? '';
  const published = process.env.RELISH_LEGAL_DOCUMENTS_PUBLISHED === 'YES';
  let legalUrl = '';
  let termsUrl = '';
  let privacyUrl = '';
  try {
    const root = new URL(appOrigin);
    if (root.protocol === 'https:' && root.username === '' && root.password === '' &&
        root.pathname === '/' && !root.search && !root.hash) {
      legalUrl = new URL('/legal', root).href;
      termsUrl = new URL('/legal/terms', root).href;
      privacyUrl = new URL('/legal/privacy', root).href;
    }
  } catch { /* Invalid/missing APP_ORIGIN leaves policy invalid: fail closed. */ }
  const valid = published && /^[\w.-]{1,60}$/.test(version) &&
    Boolean(legalUrl && termsUrl && privacyUrl);
  return { version, legalUrl, termsUrl, privacyUrl, published, valid };
}

export async function callerHasAcceptedCurrentTerms(userId: string) {
  const policy = currentRelishPolicy();
  if (!policy.valid) return false;
  const acceptance = await prisma.relishCallPolicyAcceptance.findFirst({
    where: { userId, policyVersion: policy.version, termsUrl: policy.termsUrl, privacyUrl: policy.privacyUrl },
    select: { id: true }
  });
  return Boolean(acceptance);
}

// Only an issued session determines the participant and context. Agent-supplied IDs are ignored.
export async function recordRelishVoicePolicyAcceptance(input: {
  token: unknown; conversationId: unknown; agreement: unknown;
}) {
  if (!conversationalPolicyEnabled()) return { status: 'DISABLED' as const };
  if (input.agreement !== true && input.agreement !== 'yes' && input.agreement !== 'accepted') {
    return { status: 'NOT_ACCEPTED' as const };
  }
  const token = typeof input.token === 'string' ? input.token : '';
  const conversationId = typeof input.conversationId === 'string' ? input.conversationId : '';
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token) || !/^conv_[A-Za-z0-9_-]{8,100}$/.test(conversationId)) {
    return { status: 'UNAUTHORISED' as const };
  }
  const session = await prisma.networkDorianSession.findUnique({
    where: { tokenHash: networkSessionHash(token) },
    select: { id: true, userId: true, contextSpaceId: true, conversationId: true, agentBindingId: true, expiresAt: true }
  });
  if (!session || session.conversationId !== conversationId || !(await isAuthorizedSharedDorianBindingId(session.agentBindingId)) || session.expiresAt <= new Date()) {
    return { status: 'UNAUTHORISED' as const };
  }
  const privateSpace = await prisma.contextSpace.findFirst({
    where: { id: session.contextSpaceId, ownerUserId: session.userId }, select: { id: true }
  });
  if (!privateSpace) return { status: 'UNAUTHORISED' as const };
  const policy = currentRelishPolicy();
  if (!policy.valid) return { status: 'POLICY_UNAVAILABLE' as const };
  await prisma.relishCallPolicyAcceptance.upsert({
    where: { sessionId_policyVersion: { sessionId: session.id, policyVersion: policy.version } },
    update: {},
    create: { userId: session.userId, sessionId: session.id, conversationId,
      policyVersion: policy.version, termsUrl: policy.termsUrl, privacyUrl: policy.privacyUrl,
      method: 'VOICE_EXPLICIT' }
  });
  // Only a status is returned to Dorian, never another participant's private data.
  return { status: 'ACCEPTED' as const, policy_version: policy.version };
}

export async function policyInstructionForCaller(userId: string, smsStatus: string = 'NOT_AVAILABLE') {
  if (!conversationalPolicyEnabled()) return { instruction: '', accepted: true, smsStatus: 'NOT_REQUIRED' };
  const accepted = await callerHasAcceptedCurrentTerms(userId);
  const policy = currentRelishPolicy();
  if (!policy.valid) return { instruction: 'POLICY UNAVAILABLE: Explain that the conversation cannot proceed and end the call.', accepted: false, smsStatus: 'NOT_AVAILABLE' };
  return { accepted, smsStatus: accepted ? 'NOT_REQUIRED' : smsStatus, instruction: accepted
    ? 'CONSENT STATUS ACCEPTED: The caller has already accepted the current Terms and Privacy Notice. Do not repeat the request unless the caller asks about it. Continue with the normal conversation and the participant-specific context supplied for this call.'
    : `MANDATORY FIRST PROCEDURE - CONSENT REQUIRED: Introduce yourself briefly as Dorian, an AI conversational partner. Calls may be recorded, transcribed and privately processed by Relish. ${smsStatus === 'SENT' ? 'Relish has just submitted an SMS containing the current Terms and Privacy page; do not guarantee handset delivery.' : smsStatus === 'ALREADY_SENT' ? 'Relish has previously submitted the Terms and Privacy page by SMS for this policy version; do not claim a new text has just been sent.' : 'Do not claim an SMS was sent. Offer the current policy page and explain if SMS was unavailable.'} The current policy is ${policy.legalUrl}. Ask for explicit agreement to the current Terms and Privacy Notice before substantive conversation or personal questions. Do not read the entire legal page aloud unless the caller requests an explanation; allow time to review it. On an unambiguous yes, invoke record_relish_policy_acceptance with agreement=true, the issued conversation_id and relish_network_session; WAIT for the tool result. Only if its status is ACCEPTED may you proceed in this same call. Silence, continuing the call, or SMS receipt is not consent. If refused, unavailable, or tool confirmation fails, explain briefly and end the call. This overrides persona and context instructions until acceptance.` };
}

// Stage 8.20.2: consent is a mandatory first-call procedure, not a filter on
// previously authorised, participant-scoped initiation context. The tool and
// post-call ingestion remain server-enforced gates to substantive processing.
// Keep the public import path used by inbound phone, browser and SMS callback.
export { withConsentGate } from './dorianConsentProjection';
