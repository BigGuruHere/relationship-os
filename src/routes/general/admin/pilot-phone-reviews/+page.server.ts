// Pilot-only, explicitly allowlisted read-only queue. No cross-owner approval is granted here.
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { hasCapability } from '$lib/server/core/capabilities';
import { runWithCrossOwnerWorkspaceCustody } from '$lib/server/core/contextSpace';
import { listLivingUnderstandingReviewInbox } from '$lib/server/core/livingUnderstandingReviewInbox';

function requirePilotOperator(locals: App.Locals) {
  if (!locals.user) throw redirect(303, '/auth/login');
  const allowed = (process.env.RELISH_PILOT_REVIEW_OPERATOR_USER_IDS || '')
    .split(',').map(id => id.trim()).filter(Boolean);
  if (!allowed.includes(locals.user.id) || !hasCapability(locals.capabilities, 'ADMIN'))
    throw error(403, 'Pilot review access has not been granted.');
  if (locals.contextDomainKey !== 'general' || !locals.contextSpaceId)
    throw error(403, 'Select the General ContextSpace.');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}

export const load: PageServerLoad = async ({ locals }) => {
  const operator = requirePilotOperator(locals);
  const callers = await prisma.networkPhoneCaller.findMany({
    select: { userId: true, contextSpaceId: true, contactId: true },
    take: 100
  });
  const items: Array<{ sourceInteractionId: string; participantName: string; summary: string; preview: string; occurredAt: Date; state: string; baselineRevisionNumber: number | null }> = [];
  for (const caller of callers) {
    // Identity remains provisional only while it has no authenticated account credentials.
    const account = await prisma.user.findUnique({
      where: { id: caller.userId },
      select: { email_Idx: true, oauthAccounts: { select: { id: true }, take: 1 } }
    });
    if (!account || account.email_Idx || account.oauthAccounts.length) continue;
    const reviews = await runWithCrossOwnerWorkspaceCustody({
      sourceUserId: operator.userId,
      targetUserId: caller.userId,
      targetContextSpaceId: caller.contextSpaceId,
      reason: 'PILOT_PHONE_REVIEW'
    }, () => listLivingUnderstandingReviewInbox({ userId: caller.userId, contextSpaceId: caller.contextSpaceId }, 'general'));
    for (const review of reviews) items.push({
      sourceInteractionId: review.sourceInteractionId,
      participantName: review.participantName,
      summary: review.summary,
      preview: review.preview,
      occurredAt: review.occurredAt,
      state: review.state,
      baselineRevisionNumber: review.baselineRevisionNumber
    });
  }
  items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return { pending: items.filter(item => item.state !== 'DISMISSED'), dismissedCount: items.filter(item => item.state === 'DISMISSED').length, readOnly: true };
};
