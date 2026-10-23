// Stage 8.17 - Participant-facing home, not an operator dashboard or broker CRM.
import type { PageServerLoad, Actions } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { requireRelishWorkspace, WORKSPACE_CONFIG } from '$lib/server/core/relishWorkspace';
import { ensureOwnedDomainContextSpace } from '$lib/server/core/contextSpaceDirectory';
import { loadContextProfile, loadContextPeople } from '$lib/server/core/relishWorkspaceData';
export const load: PageServerLoad = async ({ locals, params }) => {
  const space = await requireRelishWorkspace(locals, params.context);
  if (!space.configured) return { profile: null, people: [], pendingCount: 0 };
  const [profile, people] = await Promise.all([
    loadContextProfile(locals.user!.id, space.name), loadContextPeople(locals.user!.id, space.name)
  ]);
  return { profile, people: people.slice(0, 4), pendingCount: people.filter(p => p.status === 'REQUESTED').length };
};
export const actions: Actions = {
  setupAll: async ({ locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    if (locals.user.role !== 'owner') throw error(403, 'Only the pilot owner can create contexts.');
    // IT: Idempotently create the three UI contexts, preserving existing owned spaces.
    for (const name of ['business', 'friendship', 'dating'] as const) {
      await ensureOwnedDomainContextSpace(prisma, { ownerUserId: locals.user.id,
        domainKey: WORKSPACE_CONFIG[name].domain, displayName: WORKSPACE_CONFIG[name].label });
    }
    throw redirect(303, '/space/business');
  },
  setup: async ({ locals, params }) => {
    const space = await requireRelishWorkspace(locals, params.context);
    // SECURITY: Only the account owner may bootstrap all three spaces.
    if (locals.user?.role !== 'owner') throw error(403, 'Only the pilot owner can create contexts.');
    await ensureOwnedDomainContextSpace(prisma, {
      ownerUserId: locals.user.id, domainKey: WORKSPACE_CONFIG[space.name].domain,
      displayName: WORKSPACE_CONFIG[space.name].label
    });
    throw redirect(303, `/space/${space.name}`);
  }
};
