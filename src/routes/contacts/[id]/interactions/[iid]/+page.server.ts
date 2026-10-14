// src/routes/contacts/[id]/interactions/[iid]/+page.server.ts
// PURPOSE: Interaction detail plus reviewed Stage 8.4 relationship-intelligence capture.
// SECURITY: Interaction, claim and promotion actions are all workspace scoped through Core access context.

import { prisma } from '$lib/db';
import { loadNoteRevisionState, saveCurrentNoteCorrection, changeNoteLivingUnderstandingAdmission } from '$lib/server/core/noteRevisions';
import { decrypt } from '$lib/crypto';
import { error, redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createWorkspaceCoreAccess } from '$lib/server/core/accessPolicy';
import { loadCoreInteraction } from '$lib/server/core/interactions';
import { captureAndPromoteKnowledgeFromInteraction, loadClaimsForInteraction, promoteKnowledgeClaim } from '$lib/server/core/knowledge';
import { interactionSourceTypeLabel } from '$lib/interactions';
import { encryptInteractionSummary } from '$lib/server/core/interactionEncryption';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:interaction-detail');
  const row = await loadCoreInteraction(context, params.iid);
  if (!row || row.contactId !== params.id) throw error(404, 'Interaction not found');

  let contactName = '(name unavailable)';
  try { contactName = row.contact?.fullNameEnc ? decrypt(row.contact.fullNameEnc, 'contact.full_name') : contactName; } catch {}

  const revision = await loadNoteRevisionState(context, params.id, params.iid);
  if (!revision) throw error(404, 'Interaction not found');
  // IT: Old revision URLs go to the current note without exposing duplicate active notes.
  if (revision.current.id !== params.iid) throw redirect(303, `/contacts/${params.id}/interactions/${revision.current.id}`);
  const noteAdmission = await prisma.interaction.findFirst({
    where: { id: revision.current.id, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId: params.id },
    select: { luAdmission: true }
  });
  const versionEvidence = await Promise.all(revision.versions.map(async (version, index) => ({
    number: index + 1,
    id: version.id,
    claims: await loadClaimsForInteraction(context, version.id)
  })));
  const includedInLu = await prisma.livingUnderstandingRevisionSource.count({
    where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId: params.id,
      sourceInteractionId: { in: revision.versions.map((version) => version.id) } }
  });
  return {
    luAdmission: noteAdmission?.luAdmission ?? 'ELIGIBLE',
    includedInLu: includedInLu > 0,
    versionEvidence,
    revisionHistory: await Promise.all(revision.versions.map(async (version, index) => {
      // IT: Recheck the full Core custody boundary before decrypting historical content.
      const historical = await loadCoreInteraction(context, version.id);
      return { id: version.id, number: index + 1, createdAt: version.createdAt,
        text: historical?.contactId === params.id ? historical.text : '' };
    })),
    interaction: {
      id: row.id,
      channel: row.channel,
      sourceType: row.sourceType,
      sourceTypeLabel: interactionSourceTypeLabel(row.sourceType),
      occurredAt: row.occurredAt,
      text: row.text,
      summary: row.summary,
      contactId: row.contactId,
      contactName,
      // Only same-contact source IDs may be linked in the UI; detail route rechecks custody.
      correctionOfId: row.externalRef?.match(/^correction-of:([0-9a-f-]{36}):[0-9a-f-]{36}$/i)?.[1] ?? null
    },
    claims: await loadClaimsForInteraction(context, params.iid)
  };
};

export const actions: Actions = {
  changeLuAdmission: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:note-lu-admission');
    const form = await request.formData();
    const requested = String(form.get('luAdmission') ?? '');
    if (requested !== 'ELIGIBLE' && requested !== 'STORED_ONLY') return fail(400, { error: 'Invalid LU admission selection.' });
    try {
      await changeNoteLivingUnderstandingAdmission(context, params.id, params.iid, requested);
    } catch (err: any) {
      return fail(409, { error: err?.message ?? 'Cannot change LU admission.' });
    }
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  },
  editSummary: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const value = String(form.get('summary') ?? '').trim();
    const res = await prisma.interaction.updateMany({
      where: { id: params.iid, contactId: params.id, userId: locals.user.id, contextSpaceId: createWorkspaceCoreAccess(locals.user.id, 'workspace:summary-edit').contextSpaceId },
      data: { summaryEnc: value ? encryptInteractionSummary(value) : null }
    });
    if (res.count === 0) return fail(404, { error: 'Interaction not found.' });
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  },

  editText: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:note-correction');
    const original = await loadCoreInteraction(context, params.iid);
    if (!original || original.contactId !== params.id) return fail(404, { error: 'Interaction not found.' });
    const form = await request.formData();
    const value = String(form.get('text') ?? '').trim();
    if (!value) return fail(400, { error: 'Correction text cannot be empty.' });
    try {
      // IT: Append correction, never mutate text already used for provenance.
      const corrected = await saveCurrentNoteCorrection(context, params.id, params.iid, { rawText: value });
      throw redirect(303, `/contacts/${params.id}/interactions/${corrected.id}`);
    } catch (err: any) {
      if (err?.status === 303) throw err;
      return fail(409, { error: err?.message || 'Failed to save correction.' });
    }
  },

  captureKnowledge: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:capture-knowledge');
    const source = await loadCoreInteraction(context, params.iid);
    if (!source || source.contactId !== params.id) return fail(404, { error: 'Interaction not found.' });
    const form = await request.formData();
    try {
      await captureAndPromoteKnowledgeFromInteraction({
        context,
        interactionId: params.iid,
        kind: form.get('kind'),
        perspective: form.get('perspective'),
        statement: String(form.get('statement') || ''),
        authority: form.get('authority'),
        confidence: form.get('confidence'),
        evidenceNote: String(form.get('evidenceNote') || '')
      });
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Failed to capture relationship intelligence.' });
    }
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  },

  promoteClaim: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:promote-knowledge');
    const form = await request.formData();
    const claimId = String(form.get('claimId') || '').trim();
    const target = String(form.get('target') || '').trim().toUpperCase();
    if (!['OBJECTIVE', 'WANT', 'OFFER'].includes(target)) return fail(400, { error: 'Invalid structured target.' });
    try {
      const result = await promoteKnowledgeClaim({
        context,
        claimId,
        target: target as 'OBJECTIVE' | 'WANT' | 'OFFER',
        title: String(form.get('title') || '')
      });
      const href = target === 'OBJECTIVE' ? `/objectives/${result.targetId}` : target === 'WANT' ? `/wants/${result.targetId}` : `/offers/${result.targetId}`;
      throw redirect(303, href);
    } catch (err: any) {
      if (err?.status === 303) throw err;
      return fail(400, { error: err?.message || 'Failed to create structured record.' });
    }
  },

};
