// PURPOSE: Describe the human-review handoff for a newly attached conversation source.
// SECURITY: Purely reads authoritative Living Understanding state inside an already established custody scope. It never runs AI or authorises knowledge.
import { prisma } from '$lib/db';
import { relationshipApplicationBase } from '$lib/server/core/contextDomain';
import { getLivingUnderstandingReviewDisposition } from '$lib/server/core/livingUnderstandingReviewDisposition';

type Scope = { userId: string; contextSpaceId: string; contactId: string };

export type LivingUnderstandingReviewState = 'INITIAL_REVIEW_READY' | 'IMPACT_REVIEW_READY' | 'ALREADY_APPLIED' | 'DISMISSED';

export async function describeLivingUnderstandingReviewHandoff(
  scope: Scope,
  domainKey: string,
  sourceInteractionId: string
) {
  const base = relationshipApplicationBase(domainKey);
  const [baseline, applied, disposition] = await Promise.all([
    prisma.livingUnderstandingRevision.findFirst({
      where: scope,
      select: { id: true, revisionNumber: true, authorisedAt: true },
      orderBy: { revisionNumber: 'desc' }
    }),
    prisma.livingUnderstandingRevisionSource.findFirst({
      where: { ...scope, sourceInteractionId },
      select: { revisionId: true }
    }),
    getLivingUnderstandingReviewDisposition(scope, sourceInteractionId)
  ]);

  if (!applied && disposition?.status === 'DISMISSED') {
    return {
      state: 'DISMISSED' as const,
      sourceInteractionId,
      baselineRevisionNumber: baseline?.revisionNumber ?? null,
      reviewUrl: `${base}/people/${scope.contactId}/understanding?sourceInteractionId=${encodeURIComponent(sourceInteractionId)}`
    };
  }

  if (applied) {
    return {
      state: 'ALREADY_APPLIED' as const,
      sourceInteractionId,
      baselineRevisionNumber: baseline?.revisionNumber ?? null,
      reviewUrl: `${base}/people/${scope.contactId}/understanding?sourceInteractionId=${encodeURIComponent(sourceInteractionId)}`
    };
  }

  if (!baseline) {
    return {
      state: 'INITIAL_REVIEW_READY' as const,
      sourceInteractionId,
      baselineRevisionNumber: null,
      reviewUrl: `${base}/people/${scope.contactId}/understanding/initial?sourceInteractionId=${encodeURIComponent(sourceInteractionId)}`
    };
  }

  return {
    state: 'IMPACT_REVIEW_READY' as const,
    sourceInteractionId,
    baselineRevisionNumber: baseline.revisionNumber,
    reviewUrl: `${base}/people/${scope.contactId}/understanding/impact-review?sourceInteractionId=${encodeURIComponent(sourceInteractionId)}`
  };
}
