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
    ? 'The caller has previously accepted the current Terms and Privacy Notice. Do not repeat the consent request unless asked.'
    : `CONSENT GATE: You are an AI networking partner. Before asking substantive questions, clearly explain that the call may be recorded/transcribed and privately processed by Relish. The Terms and Privacy Notice are both available at ${policy.legalUrl}, linked on the invitation page and sent by SMS.  Ask for explicit agreement. Only after the caller clearly agrees, immediately invoke the ElevenLabs tool record_relish_policy_acceptance with agreement=true, the current conversation_id and relish_network_session. Wait for status ACCEPTED before continuing. If declined, unclear or tool fails, do not proceed: politely end the call. Do not tell anyone that merely continuing or sending an SMS constitutes consent.` };
}

// Remove private memory before agreement. This remains a one-call limitation if a returning
// participant must agree to a newer policy; the next call can retrieve their history.
export function withConsentGate(dynamicVariables: Record<string, unknown>, policy: {instruction: string; accepted: boolean}) {
  const vars = { ...dynamicVariables };
  if (!policy.accepted) {
    for (const key of ['living_understanding','living_understanding_revision','relish_living_understanding',
      'relish_living_understanding_revision','last_call_summary','memory_and_identity_context','user_name']) vars[key] = '';
  }
  vars.relish_terms_status = policy.accepted ? 'ACCEPTED' : 'REQUIRED';
  vars.call_instruction = [String(vars.call_instruction || ''), policy.instruction].filter(Boolean).join(' ');
  return vars;
}
