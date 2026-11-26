// Stage 8.22: policy-link SMS is triggered by Relish, never by the voice agent.
// Idempotent claim prevents retries/parallel initiation requests sending multiple texts.
import { randomUUID } from 'node:crypto';
import { scheduleNonblockingTask } from './nonblockingAfterResponse.mjs';
import { prisma } from '$lib/db';
import { buildScopedIndexToken, decrypt } from '$lib/crypto';
import { normalizePhoneForIdentity } from '$lib/server/integrations/elevenlabs/phone';
import { sendTelnyxSms } from '$lib/server/integrations/telnyx/messaging';
import { resolveDorianPolicySmsPhone } from '$lib/server/foundation/accountChannels';
import { currentDorianTelephonePolicy, currentRelishPolicy, conversationalPolicyEnabled } from './relishCallPolicy';

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


// Stage 8.22.4: creating an outbox record never waits for Telnyx. A separate
// worker (and a best-effort local kick) will deliver the link. Consent is never
// inferred from the SMS being submitted, received or delivered.
export async function enqueueCurrentPolicySms(input: {
  userId: string; phone: unknown; accepted: boolean;
  policy?: ReturnType<typeof currentRelishPolicy>;
  channel?: { phoneChannelId: string; phoneChannelGeneration: number };
}): Promise<TermsSmsStatus> {
  if (!conversationalPolicyEnabled() || input.accepted) return 'NOT_REQUIRED';
  const policy = input.policy ?? currentRelishPolicy();
  if (!policy.valid || !normalizePhoneForIdentity(input.phone)) return 'NOT_AVAILABLE';
  const key = { userId_policyVersion_legalUrl: {
    userId: input.userId, policyVersion: policy.version, legalUrl: policy.legalUrl
  } };
  try {
    await prisma.relishPolicySmsDispatch.create({ data: {
      id: randomUUID(), userId: input.userId, policyVersion: policy.version,
      legalUrl: policy.legalUrl, state: 'QUEUED', ...input.channel
    } });
    return 'PENDING';
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error;
    const existing = await prisma.relishPolicySmsDispatch.findUnique({ where: key,
      select: { id: true, state: true, phoneChannelId: true, phoneChannelGeneration: true } });
    const channel = input.channel;
    // If the account re-verifies or changes its phone, a failed delivery must
    // not stay pinned to the obsolete proof. Let a claimed send finish first.
    if (existing && channel && existing.state !== 'SENT' && existing.state !== 'SENDING' &&
        (existing.phoneChannelId !== channel.phoneChannelId ||
          existing.phoneChannelGeneration !== channel.phoneChannelGeneration)) {
      await prisma.relishPolicySmsDispatch.updateMany({
        where: { id: existing.id, state: existing.state, phoneChannelId: existing.phoneChannelId,
          phoneChannelGeneration: existing.phoneChannelGeneration },
        data: { ...channel, state: 'QUEUED', lastErrorCode: null }
      });
    }
    return existing?.state === 'SENT' ? 'ALREADY_SENT' : 'PENDING';
  }
}

// Durable outbox delivery. A failed send is retried after five minutes;
// a process crash during SENDING can also be recovered after the lease.
export async function drainQueuedPolicySms(limit = 5): Promise<number> {
  if (!conversationalPolicyEnabled()) return 0;
  const relish = currentRelishPolicy();
  const dorian = currentDorianTelephonePolicy();
  // The existing phone-channel binding identifies Foundation dispatches.
  // After switching documents, queued notices for an older policy are skipped.
  const policies = [
    { ...relish, phoneChannelId: null },
    { ...dorian, phoneChannelId: { not: null } }
  ].filter(policy => policy.valid);
  if (!policies.length) return 0;
  const retryCutoff = new Date(Date.now() - 5 * 60 * 1000);
  const rows = await prisma.relishPolicySmsDispatch.findMany({
    where: { AND: [{ OR: policies.map(policy => ({
      policyVersion: policy.version, legalUrl: policy.legalUrl, phoneChannelId: policy.phoneChannelId
    })) }],
      OR: [{ state: 'QUEUED' },
        { state: { in: ['FAILED', 'SENDING', 'PENDING'] }, attemptedAt: { lt: retryCutoff } }] },
    orderBy: { attemptedAt: 'asc' }, take: Math.max(1, Math.min(20, limit))
  });
  let sent = 0;
  for (const row of rows) {
    const current = row.phoneChannelId ? dorian : relish;
    const claimed = await prisma.relishPolicySmsDispatch.updateMany({
      where: { id: row.id, OR: [{ state: 'QUEUED' },
        { state: { in: ['FAILED', 'SENDING', 'PENDING'] }, attemptedAt: { lt: retryCutoff } }] },
      data: { state: 'SENDING', attemptedAt: new Date(), lastErrorCode: null }
    });
    if (!claimed.count) continue;
    try {
      // A Foundation destination is revalidated on retry. A revoked or replaced
      // mobile can never receive a queued notice for its old generation.
      const phone = row.phoneChannelId && row.phoneChannelGeneration !== null
        ? await resolveDorianPolicySmsPhone(row.userId, row.phoneChannelId, row.phoneChannelGeneration)
        : await provisionalSmsPhone(row.userId);
      if (!phone) {
        await prisma.relishPolicySmsDispatch.update({ where: { id: row.id },
          data: { state: 'FAILED', lastErrorCode: row.phoneChannelId ? 'NO_CURRENT_PHONE' : 'NO_PROVISIONAL_PHONE' } });
        continue;
      }
      const idx = buildScopedIndexToken(phone, 'network:provisional-phone:v1');
      const optedOut = await prisma.pilotSmsOptOut.findUnique({ where: { phoneIndex: idx } });
      if (optedOut?.optedOutAt && (!optedOut.resumedAt || optedOut.resumedAt <= optedOut.optedOutAt)) {
        await prisma.relishPolicySmsDispatch.update({ where: { id: row.id },
          data: { state: 'FAILED', lastErrorCode: 'SMS_OPTED_OUT' } });
        continue;
      }
      // Check again: consent may have been recorded while the message was queued.
      const accepted = await prisma.relishCallPolicyAcceptance.findFirst({
        where: { userId: row.userId, policyVersion: current.version,
          termsUrl: current.termsUrl, privacyUrl: current.privacyUrl }, select: { id: true }
      });
      if (accepted) {
        await prisma.relishPolicySmsDispatch.update({ where: { id: row.id },
          data: { state: 'SENT', lastErrorCode: 'ALREADY_ACCEPTED_NO_SMS' } });
        continue;
      }
      const message = current.legalUrl === relish.legalUrl
        ? `Relish: Please review the current Terms of Use and Privacy Notice before speaking with Dorian: ${current.legalUrl} Calls may be recorded, transcribed and privately processed with your agreement. Reply STOP to opt out of texts.`
        : `Dorian Kreed: Please review our Terms and Privacy Policy before your AI call: ${current.legalUrl} Reply STOP to opt out of texts.`;
      await sendTelnyxSms(phone, message);
      await prisma.relishPolicySmsDispatch.update({ where: { id: row.id },
        data: { state: 'SENT', acceptedAt: new Date() } });
      sent++;
    } catch (error) {
      const code = error instanceof Error && /^TELNYX_SMS_HTTP_\d{3}$/.test(error.message)
        ? error.message : 'SMS_SEND_FAILED';
      await prisma.relishPolicySmsDispatch.update({ where: { id: row.id },
        data: { state: 'FAILED', lastErrorCode: code } });
    }
  }
  return sent;
}

async function provisionalSmsPhone(userId: string) {
  const caller = await prisma.networkPhoneCaller.findUnique({ where: { userId }, select: { phoneEnc: true } });
  return caller?.phoneEnc ? normalizePhoneForIdentity(decrypt(caller.phoneEnc, 'network.phone')) : null;
}

// This kick is non-blocking and useful in local/Railway Node processes.
// The dedicated worker is the durable safety net if this process terminates.
export function kickQueuedPolicySms() {
  scheduleNonblockingTask(() => drainQueuedPolicySms(2), () => {
    console.warn('[relish-policy] Async SMS dispatch will be retried by worker.');
  });
}
