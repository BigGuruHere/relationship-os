// Stage 8.22.3c: Relish-owned continuity policy, independent of voice providers.
// An unconfirmed two-hour lease is NOT the ten-minute after-completion LU window.
export const UNCONFIRMED_ACTIVE_CALL_LEASE_MS = 2 * 60 * 60 * 1000;
export const COMPLETED_CALL_UNDERSTANDING_WINDOW_MS = 10 * 60 * 1000;

/**
 * Missing end events do not prove hang-up. The separate, bounded active-call
 * safety lease is the last-resort fail-open policy for a lost completion event.
 * @param {Date | string | null | undefined} startedAt
 * @param {Date} [now]
 */
export function unconfirmedCallLeaseExpired(startedAt, now = new Date()) {
  if (!startedAt) return false;
  const start = new Date(startedAt).getTime();
  return Number.isFinite(start) && start > 0 &&
    now.getTime() - start >= UNCONFIRMED_ACTIVE_CALL_LEASE_MS;
}

/**
 * The ledger's physical call state and Relish's understanding state are distinct.
 * No provider name, API query or transcript is needed to evaluate the next call.
 * @param {{callState:string, understandingState?:string|null, startedAt?:Date|string|null, endedAt?:Date|string|null}|null} call
 * @param {Date} [now]
 * @returns {'RELEASE'|'EXPIRE_PROCESSING'|'WAIT_PROCESSING'|'WAIT_ACTIVE'|'ABANDON_UNCONFIRMED'|'UNKNOWN'}
 */
export function continuityAction(call, now = new Date()) {
  if (!call) return 'UNKNOWN';
  if (call.callState === 'UNCONFIRMED') return 'RELEASE';
  if (call.callState === 'STARTED') return unconfirmedCallLeaseExpired(call.startedAt, now)
    ? 'ABANDON_UNCONFIRMED' : 'WAIT_ACTIVE';
  if (call.callState !== 'ENDED' || !call.endedAt) return 'UNKNOWN';
  if (['COMPLETED', 'FAILED', 'NOT_REQUIRED', 'EXPIRED'].includes(call.understandingState || ''))
    return 'RELEASE';
  const endedMs = new Date(call.endedAt).getTime();
  if (Number.isFinite(endedMs) && now.getTime() - endedMs >= COMPLETED_CALL_UNDERSTANDING_WINDOW_MS)
    return 'EXPIRE_PROCESSING';
  return 'WAIT_PROCESSING';
}
