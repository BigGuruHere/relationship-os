// Stage 8.12.0.1: a retry of an unchanged operator review must not create another history event.
export type ReviewSnapshot = { statement: string; decision: string; note?: string };
export function shouldAppendUnderstandingReview(previous: ReviewSnapshot | null, next: ReviewSnapshot): boolean {
  if (!previous) return true;
  return previous.statement !== next.statement || previous.decision !== next.decision ||
    (Boolean(next.note?.trim()) && next.note?.trim() !== (previous.note ?? '').trim());
}
