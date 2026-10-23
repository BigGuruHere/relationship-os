// Stage 8.17 - Only established Friendship connections and explicitly shared pilot requests.
import type { PageServerLoad } from './$types';
import { requireRelishWorkspace } from '$lib/server/core/relishWorkspace';
import { loadContextPeople } from '$lib/server/core/relishWorkspaceData';
import { prisma } from '$lib/db';
import { recordPilotEvent } from '$lib/server/pilot';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
export const load: PageServerLoad = async ({ locals, params }) => {
  const space = await requireRelishWorkspace(locals, params.context);
  return { people: space.configured ? await loadContextPeople(locals.user!.id, space.name) : [] };
};


// Only the owner may approve their own context-specific requests.
export const actions: Actions = {
  approve: async ({ locals, params, request }) => {
    const workspace = await requireRelishWorkspace(locals, params.context);
    const form = await request.formData();
    const id = String(form.get('requestId') || '');
    if (!id) return fail(400, { error: 'Missing request.' });
    const pending = await prisma.pilotConnectionRequest.findFirst({ where: {
      id, ownerUserId: locals.user!.id, domainKey: workspace.domain, status: 'REQUESTED'
    }, include: { entry: { select: { environment: true, entrySource: true } } } });
    if (!pending) return fail(409, { error: 'Request is no longer pending.' });
    const accepted = await prisma.pilotConnectionRequest.updateMany({ where: {
      id, ownerUserId: locals.user!.id, domainKey: workspace.domain, status: 'REQUESTED'
    }, data: { status: 'ACCEPTED' } });
    if (accepted.count !== 1) return fail(409, { error: 'Request is no longer pending.' });
    await recordPilotEvent({ type: 'relationship.connection_accepted', env: pending.entry.environment,
      profileId: pending.profileId, ownerUserId: pending.ownerUserId,
      domainKey: workspace.domain as 'business' | 'general' | 'dating',
      entryId: pending.entryId, visitorUserId: pending.visitorUserId,
      source: pending.entry.entrySource, dedup: 'approved:' + pending.id });
    return { approved: true };
  }
};
