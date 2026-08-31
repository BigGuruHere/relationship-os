// src/routes/knowledge/[id]/+page.server.ts
// PURPOSE: Universal KnowledgeClaim detail surface for Facts, Objectives, Wants, Offers and other claim types.
// SECURITY: All claim/evidence reads and writes are scoped to the signed-in Relish workspace.

import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createWorkspaceCoreAccess } from '$lib/server/core/accessPolicy';
import {
  loadKnowledgeClaim,
  promoteKnowledgeClaim,
  setKnowledgeClaimStatus,
  setKnowledgeEvidenceStatus
} from '$lib/server/core/knowledge';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:knowledge-detail');
  const claim = await loadKnowledgeClaim(context, params.id);
  if (!claim) throw error(404, 'Knowledge claim not found');
  return { claim };
};

export const actions: Actions = {
  setClaimStatus: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:knowledge-claim-status');
    const form = await request.formData();
    const status = String(form.get('status') || '').trim().toUpperCase();
    if (!['ACTIVE', 'SUPERSEDED', 'REJECTED'].includes(status)) return fail(400, { error: 'Invalid claim status.' });
    try {
      await setKnowledgeClaimStatus(context, params.id, status as 'ACTIVE' | 'SUPERSEDED' | 'REJECTED');
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Failed to update claim status.' });
    }
    throw redirect(303, `/knowledge/${params.id}`);
  },

  setEvidenceStatus: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:knowledge-evidence-status');
    const form = await request.formData();
    const evidenceId = String(form.get('evidenceId') || '').trim();
    const status = String(form.get('status') || '').trim().toUpperCase();
    if (!evidenceId) return fail(400, { error: 'Evidence id is required.' });
    if (!['ACTIVE', 'SUPERSEDED', 'REJECTED'].includes(status)) return fail(400, { error: 'Invalid evidence status.' });
    try {
      await setKnowledgeEvidenceStatus(context, params.id, evidenceId, status as 'ACTIVE' | 'SUPERSEDED' | 'REJECTED');
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Failed to update evidence status.' });
    }
    throw redirect(303, `/knowledge/${params.id}`);
  },

  promote: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:knowledge-promote');
    const form = await request.formData();
    const target = String(form.get('target') || '').trim().toUpperCase();
    if (!['OBJECTIVE', 'WANT', 'OFFER'].includes(target)) return fail(400, { error: 'Invalid structured target.' });
    try {
      const result = await promoteKnowledgeClaim({
        context,
        claimId: params.id,
        target: target as 'OBJECTIVE' | 'WANT' | 'OFFER'
      });
      const href = target === 'OBJECTIVE' ? `/objectives/${result.targetId}` : target === 'WANT' ? `/wants/${result.targetId}` : `/offers/${result.targetId}`;
      throw redirect(303, href);
    } catch (err: any) {
      if (err?.status === 303) throw err;
      return fail(400, { error: err?.message || 'Failed to create structured record.' });
    }
  }
};
