// src/routes/contacts/[id]/interactions/[iid]/+page.server.ts
// PURPOSE: Interaction detail plus reviewed Stage 8.4 relationship-intelligence capture.
// SECURITY: Interaction, claim and promotion actions are all workspace scoped through Core access context.

import { prisma } from '$lib/db';
import { decrypt, encrypt } from '$lib/crypto';
import { error, redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createWorkspaceCoreAccess } from '$lib/server/core/accessPolicy';
import { loadCoreInteraction } from '$lib/server/core/interactions';
import { captureAndPromoteKnowledgeFromInteraction, loadClaimsForInteraction, promoteKnowledgeClaim } from '$lib/server/core/knowledge';
import { interactionSourceTypeLabel } from '$lib/interactions';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:interaction-detail');
  const row = await loadCoreInteraction(context, params.iid);
  if (!row || row.contactId !== params.id) throw error(404, 'Interaction not found');

  let contactName = '(name unavailable)';
  try { contactName = row.contact?.fullNameEnc ? decrypt(row.contact.fullNameEnc, 'contact.full_name') : contactName; } catch {}

  return {
    interaction: {
      id: row.id,
      channel: row.channel,
      sourceType: row.sourceType,
      sourceTypeLabel: interactionSourceTypeLabel(row.sourceType),
      occurredAt: row.occurredAt,
      text: row.text,
      summary: row.summary,
      contactId: row.contactId,
      contactName
    },
    claims: await loadClaimsForInteraction(context, params.iid)
  };
};

export const actions: Actions = {
  editSummary: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const value = String(form.get('summary') ?? '').trim();
    const res = await prisma.interaction.updateMany({
      where: { id: params.iid, contactId: params.id, userId: locals.user.id },
      data: { summaryEnc: value ? encrypt(value, 'interaction.raw_text') : null }
    });
    if (res.count === 0) return fail(404, { error: 'Interaction not found.' });
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  },

  editText: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const value = String(form.get('text') ?? '').trim();
    const res = await prisma.interaction.updateMany({
      where: { id: params.iid, contactId: params.id, userId: locals.user.id },
      data: { rawTextEnc: encrypt(value, 'interaction.raw_text') }
    });
    if (res.count === 0) return fail(404, { error: 'Interaction not found.' });
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
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
