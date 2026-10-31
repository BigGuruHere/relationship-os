// Stage 8.22: policy-link SMS is triggered by Relish, never by the voice agent.
// Idempotent claim prevents retries/parallel initiation requests sending multiple texts.
import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/db';
import { buildScopedIndexToken } from '$lib/crypto';
import { normalizePhoneForIdentity } from '$lib/server/integrations/elevenlabs/phone';
import { sendTelnyxSms } from '$lib/server/integrations/telnyx/messaging';
import { currentRelishPolicy, conversationalPolicyEnabled } from './relishCallPolicy';

export type TermsSmsStatus = 'SENT' | 'ALREADY_SENT' | 'FAILED' | 'PENDING' | 'NOT_REQUIRED' | 'NOT_AVAILABLE';

export async function dispatchCurrentPolicySms(input: { userId: string; phone: unknown; accepted: boolean }): Promise<TermsSmsStatus> {
  if (!conversationalPolicyEnabled() || input.accepted) return 'NOT_REQUIRED';
  const policy = currentRelishPolicy();
  const phone = normalizePhoneForIdentity(input.phone);
  if (!policy.valid || !phone) return 'NOT_AVAILABLE';
  // Respect the same opt-out index used by the existing SMS invitation flow.
  const phoneIndex = buildScopedIndexToken(phone, 'network:provisional-phone:v1');
  const optedOut = await prisma.pilotSmsOptOut.findUnique({ where: { phoneIndex } });
  if (optedOut?.optedOutAt && (!optedOut.resumedAt || optedOut.resumedAt <= optedOut.optedOutAt)) return 'NOT_AVAILABLE';
  const key = { userId_policyVersion_legalUrl: {
    userId: input.userId, policyVersion: policy.version, legalUrl: policy.legalUrl
  } };
  let claimed = false;
  try {
    await prisma.relishPolicySmsDispatch.create({ data: {
      id: randomUUID(), userId: input.userId, policyVersion: policy.version, legalUrl: policy.legalUrl
    } });
    claimed = true;
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error;
    const previous = await prisma.relishPolicySmsDispatch.findUnique({ where: key });
    if (!previous) return 'PENDING';
    if (previous.state === 'SENT') return 'ALREADY_SENT';
    // A failed or stale submission may be retried only after a cooldown.
    const retryAfter = new Date(Date.now() - 5 * 60 * 1000);
    const updated = await prisma.relishPolicySmsDispatch.updateMany({ where: {
      id: previous.id, state: { in: ['FAILED', 'PENDING'] }, attemptedAt: { lt: retryAfter }
    }, data: { state: 'PENDING', attemptedAt: new Date(), lastErrorCode: null } });
    claimed = updated.count === 1;
  }
  if (!claimed) return 'PENDING';
  try {
    await sendTelnyxSms(phone, `Relish: Please review the current Terms of Use and Privacy Notice before speaking with Dorian: ${policy.legalUrl} Calls may be recorded, transcribed and privately processed with your agreement. Reply STOP to opt out of texts.`);
    await prisma.relishPolicySmsDispatch.update({ where: key, data: { state: 'SENT', acceptedAt: new Date() } });
    return 'SENT';
  } catch (error) {
    // Do not include phone numbers, provider bodies or message content in diagnostic records.
    const code = error instanceof Error && /^TELNYX_SMS_HTTP_\d{3}$/.test(error.message)
      ? error.message : 'SMS_SEND_FAILED';
    await prisma.relishPolicySmsDispatch.update({ where: key, data: { state: 'FAILED', lastErrorCode: code } });
    return 'FAILED';
  }
}
