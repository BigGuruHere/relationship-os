// Pure, tested state policy; no database calls and no caller content.
export type RecoveryOperation = 'RETRY' | 'RELEASE' | 'MARK_FAILED';
export type RecoveryState = 'IN_CALL' | 'PROCESSING' | 'WORKING' | 'FAILED' | 'QUEUED' | string | null;

export function recoveryEligibility(state: RecoveryState, since: Date | null, hasEvidence: boolean, now: number): {
  stale: boolean; actions: RecoveryOperation[]
} {
  const age = since ? now - since.getTime() : -1;
  const stale = state === 'FAILED' ||
    (state === 'IN_CALL' && age >= 15 * 60_000) ||
    (state === 'WORKING' && age >= 60 * 60_000) ||
    ((state === 'PROCESSING' || state === 'QUEUED') && age >= 2 * 60 * 60_000);
  const actions: RecoveryOperation[] = [];
  if (stale) {
    if (state === 'FAILED') { if (hasEvidence) actions.push('RETRY'); actions.push('RELEASE'); }
    else if (state === 'WORKING') actions.push('MARK_FAILED');
    else if (state === 'IN_CALL') { if (hasEvidence) actions.push('RETRY'); actions.push('RELEASE'); }
    else if (state === 'PROCESSING' || state === 'QUEUED') actions.push('RELEASE');
  }
  return { stale, actions };
}
