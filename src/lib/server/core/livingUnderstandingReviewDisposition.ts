// PURPOSE: Operator-controlled review queue disposition for imported conversation evidence.
// SECURITY: Dismiss/restore changes review workflow metadata only. It never deletes source evidence or mutates authoritative Living Understanding.
import { prisma } from '$lib/db';
import { PERSON_CONVERSATION_SOURCE_CHANNEL } from '$lib/server/core/conversationIngestion';

type Scope = { userId: string; contextSpaceId: string; contactId: string };

async function requireSource(scope: Scope, sourceInteractionId: string) {
  const source = await prisma.interaction.findFirst({
    where: {
      id: sourceInteractionId,
      userId: scope.userId,
      contextSpaceId: scope.contextSpaceId,
      contactId: scope.contactId,
      channel: PERSON_CONVERSATION_SOURCE_CHANNEL
    },
    select: { id: true }
  });
  if (!source) throw new Error('Conversation source is not accessible for this participant.');
}

export async function getLivingUnderstandingReviewDisposition(scope: Scope, sourceInteractionId: string) {
  return prisma.livingUnderstandingSourceReviewDisposition.findFirst({
    where: { ...scope, sourceInteractionId },
    select: { status: true, dismissedAt: true, restoredAt: true }
  });
}


export async function listLivingUnderstandingReviewDispositions(
  scope: Scope,
  sourceInteractionIds: string[]
) {
  const ids = [...new Set(sourceInteractionIds.filter(Boolean))];
  if (!ids.length) return [];
  return prisma.livingUnderstandingSourceReviewDisposition.findMany({
    where: { ...scope, sourceInteractionId: { in: ids } },
    select: { sourceInteractionId: true, status: true, dismissedAt: true, restoredAt: true }
  });
}

export async function dismissLivingUnderstandingReview(scope: Scope, sourceInteractionId: string) {
  await requireSource(scope, sourceInteractionId);
  return prisma.livingUnderstandingSourceReviewDisposition.upsert({
    where: {
      userId_contextSpaceId_contactId_sourceInteractionId: { ...scope, sourceInteractionId }
    },
    create: { ...scope, sourceInteractionId, status: 'DISMISSED', dismissedAt: new Date(), restoredAt: null },
    update: { status: 'DISMISSED', dismissedAt: new Date(), restoredAt: null },
    select: { id: true, status: true, dismissedAt: true }
  });
}

export async function restoreLivingUnderstandingReview(scope: Scope, sourceInteractionId: string) {
  await requireSource(scope, sourceInteractionId);
  return prisma.livingUnderstandingSourceReviewDisposition.upsert({
    where: {
      userId_contextSpaceId_contactId_sourceInteractionId: { ...scope, sourceInteractionId }
    },
    create: { ...scope, sourceInteractionId, status: 'ACTIVE', dismissedAt: null, restoredAt: new Date() },
    update: { status: 'ACTIVE', restoredAt: new Date() },
    select: { id: true, status: true, restoredAt: true }
  });
}
