// Stage 8.19 - A session-bound, explicit voice acceptance gate for Relish onboarding.
// A signed ElevenLabs tool must call the acceptance endpoint after the caller says yes.
// Never interpret a QR scan, SMS, silence or mere continuation as acceptance.
import { prisma } from '$lib/db';
import { configuredSharedBindingId, networkSessionHash } from '$lib/server/integrations/elevenlabs/networkSession';

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
  const bindingId = configuredSharedBindingId();
  if (!bindingId) return { status: 'UNAUTHORISED' as const };
  const session = await prisma.networkDorianSession.findUnique({
    where: { tokenHash: networkSessionHash(token) },
    select: { id: true, userId: true, contextSpaceId: true, conversationId: true, agentBindingId: true, expiresAt: true }
  });
  if (!session || session.conversationId !== conversationId || session.agentBindingId !== bindingId || session.expiresAt <= new Date()) {
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

export async function policyInstructionForCaller(userId: string) {
  if (!conversationalPolicyEnabled()) return { instruction: '', accepted: true };
  const accepted = await callerHasAcceptedCurrentTerms(userId);
  const policy = currentRelishPolicy();
  if (!policy.valid) return { instruction: 'POLICY UNAVAILABLE: Explain that the conversation cannot proceed and end the call.', accepted: false };
  return { accepted, instruction: accepted
    ? 'CONSENT STATUS ACCEPTED: The caller has already accepted the current Terms and Privacy Notice. Do not repeat the request unless the caller asks about it. Continue with the normal conversation and the participant-specific context supplied for this call.'
    : `MANDATORY FIRST PROCEDURE — CONSENT REQUIRED: You are Dorian, an AI networking partner. Before any substantive discussion, use of prior personal context, personal questions, or other Relish tools, explain briefly that the call may be recorded, transcribed, and privately processed by Relish. The current Terms and Privacy Notice are available at ${policy.legalUrl} (also linked on the invitation page or sent by SMS). Ask for the caller's explicit agreement to continue under the current Terms and Privacy Notice. Do NOT treat silence, mere continuation, an SMS or an invitation as acceptance. After an unambiguous affirmative response, IMMEDIATELY invoke record_relish_policy_acceptance with agreement=true, the current conversation_id and relish_network_session, and WAIT for the tool result. Only if its status is ACCEPTED may you begin the substantive conversation and use the name, Living Understanding, last-call summary and ContextSpace guidance already supplied at initiation. Continue naturally in this same call; do not restart onboarding or ask the caller to call back. If declined, acceptance remains unclear after a brief clarification, the policy is unavailable or the tool result is anything other than ACCEPTED, politely end the call using end_call. This procedure takes precedence over persona, scenario and context guidance until accepted.` };
}

// Stage 8.20.2: consent is a mandatory first-call procedure, not a filter on
// previously authorised, participant-scoped initiation context. The tool and
// post-call ingestion remain server-enforced gates to substantive processing.
// Keep the public import path used by inbound phone, browser and SMS callback.
export { withConsentGate } from './dorianConsentProjection';
