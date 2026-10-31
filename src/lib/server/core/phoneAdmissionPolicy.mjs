// Stage 8.22.4: a phone attempt is not evidence of an ongoing LU job.
// Only completed-call ingestion and understanding work may delay another call.
/**
 * Determine whether an earlier completed call's understanding still requires a hold.
 * Attempt-only and legacy IN_CALL statuses are intentionally never a continuity hold.
 * @param {string | null | undefined} state
 * @returns {'TRANSCRIPT_INGEST_PENDING' | 'UNDERSTANDING_PENDING' | null}
 */
export function continuityHoldReason(state) {
  if (state === 'AWAITING_INGEST') return 'TRANSCRIPT_INGEST_PENDING';
  if (state === 'PROCESSING' || state === 'WORKING') return 'UNDERSTANDING_PENDING';
  return null;
}
