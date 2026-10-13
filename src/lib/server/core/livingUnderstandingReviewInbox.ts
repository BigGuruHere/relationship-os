// PURPOSE: Build the General-context human supervision queue for Living Understanding conversation reviews.
// SECURITY: Sources remain immutable. Queue state is derived from authoritative LU + explicit operator disposition.
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { decryptInteractionSummary } from '$lib/server/core/interactionEncryption';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { PERSON_CONVERSATION_SOURCE_CHANNEL } from '$lib/server/core/conversationIngestion';
import { describeLivingUnderstandingReviewHandoff } from '$lib/server/core/livingUnderstandingReviewHandoff';
import { loadLatestLivingUnderstandingDraftForSource } from '$lib/server/datingLivingUnderstandingDraft';

type Scope = { userId: string; contextSpaceId: string };
const AAD = 'interaction.raw_text';

export async function listLivingUnderstandingReviewInbox(scope: Scope, domainKey: string) {
  const rows = await prisma.interaction.findMany({
    where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, channel: PERSON_CONVERSATION_SOURCE_CHANNEL },
    select: { id: true, contactId: true, occurredAt: true, rawTextEnc: true, summaryEnc: true },
    orderBy: { occurredAt: 'desc' },
    take: 250
  });
  const contactIds = [...new Set(rows.map(row => row.contactId).filter(Boolean))] as string[];
  const contacts = await prisma.contact.findMany({
    where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, id: { in: contactIds } },
    select: { id: true, fullNameEnc: true }
  });
  const names = new Map((await Promise.all(contacts.map(async contact => [contact.id, await contactDisplayName(contact)] as const))));

  const items = [] as any[];
  for (const row of rows) {
    if (!row.contactId) continue;
    const review = await describeLivingUnderstandingReviewHandoff({ ...scope, contactId: row.contactId }, domainKey, row.id);
    if (review.state === 'ALREADY_APPLIED') continue;
    const payload = JSON.parse(decrypt(row.rawTextEnc, AAD)) as any;
    const draft = review.state === 'IMPACT_REVIEW_READY'
      ? await loadLatestLivingUnderstandingDraftForSource({ ...scope, contactId: row.contactId }, row.id)
      : null;
    items.push({
      sourceInteractionId: row.id,
      contactId: row.contactId,
      participantName: names.get(row.contactId) || 'Unnamed participant',
      occurredAt: row.occurredAt,
      provider: String(payload?.provider || 'Conversation'),
      summary: decryptInteractionSummary(row.summaryEnc),
      preview: String(payload?.text || '').replace(/\s+/g, ' ').slice(0, 280),
      state: review.state,
      baselineRevisionNumber: review.baselineRevisionNumber,
      reviewUrl: review.reviewUrl,
      proposalReady: Boolean(draft?.stage === 'AUTO_PROPOSAL_READY' && draft?.impactProposal)
    });
  }
  return items;
}
