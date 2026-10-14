// Stage 8.15.3: destructive note actions must be POST and cannot erase referenced evidence.
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { createWorkspaceCoreAccess } from '$lib/server/core/accessPolicy';
import { findCoreInteraction } from '$lib/server/core/relationshipRepository';

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:delete-unreferenced-note');
  const note = await findCoreInteraction(context, params.iid, { id: true, contactId: true });
  if (!note || note.contactId !== params.id) return new Response('Note not found.', { status: 404 });

  // Keep source evidence whenever knowledge or LU revisions cite it.
  const [knowledge, revisions, versions, drafts, dispositions, wants, offers, objectives, introductions, outcomes, corrections] = await Promise.all([
    prisma.knowledgeEvidence.count({ where: { sourceInteractionId: note.id } }),
    prisma.livingUnderstandingRevisionSource.count({ where: { sourceInteractionId: note.id } }),
    prisma.livingUnderstandingTopicVersionSource.count({ where: { sourceInteractionId: note.id } }),
    prisma.livingUnderstandingDraft.count({ where: { sourceInteractionId: note.id } }),
    prisma.livingUnderstandingSourceReviewDisposition.count({ where: { sourceInteractionId: note.id } }),
    prisma.want.count({ where: { sourceInteractionId: note.id } }),
    prisma.offer.count({ where: { sourceInteractionId: note.id } }),
    prisma.objective.count({ where: { sourceInteractionId: note.id } }),
    prisma.introduction.count({ where: { sourceInteractionId: note.id } }),
    prisma.outcome.count({ where: { sourceInteractionId: note.id } }),
    prisma.interaction.count({ where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, externalRef: { startsWith: `correction-of:${note.id}:` } } })
  ]);
  if (knowledge + revisions + versions + drafts + dispositions + wants + offers + objectives + introductions + outcomes + corrections > 0) {
    return new Response('This note is referenced by relationship intelligence and must be retained. Add a correction instead.', { status: 409 });
  }
  await prisma.interaction.deleteMany({ where: {
    id: note.id, contactId: params.id, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId
  } });
  throw redirect(303, `/contacts/${params.id}`);
};
