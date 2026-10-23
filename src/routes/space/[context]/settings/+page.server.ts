// Stage 8.18 - Preferences are always owned by the selected workspace and user.
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { requireRelishWorkspace } from '$lib/server/core/relishWorkspace';
import { loadContextProfile } from '$lib/server/core/relishWorkspaceData';

export const load: PageServerLoad = async ({ locals, params }) => {
  const space = await requireRelishWorkspace(locals, params.context);
  const preferences = await prisma.relishContextPreference.findUnique({ where: {
    ownerUserId_domainKey: { ownerUserId: locals.user!.id, domainKey: space.domain }
  } });
  return { profile: space.configured ? await loadContextProfile(locals.user!.id, space.name) : null,
    connectionMode: preferences?.connectionMode || 'AUTOMATIC',
    dorianMode: preferences?.dorianMode || 'SMS_CALLBACK' };
};

export const actions: Actions = {
  save: async ({ locals, params, request }) => {
    const space = await requireRelishWorkspace(locals, params.context);
    const form = await request.formData();
    const connectionMode = String(form.get('connectionMode'));
    const dorianMode = String(form.get('dorianMode'));
    if (!['AUTOMATIC', 'APPROVAL'].includes(connectionMode) || !['SMS_CALLBACK', 'BROWSER'].includes(dorianMode))
      return fail(400, { error: 'Invalid settings.' });
    await prisma.relishContextPreference.upsert({
      where: { ownerUserId_domainKey: { ownerUserId: locals.user!.id, domainKey: space.domain } },
      update: { connectionMode, dorianMode },
      create: { ownerUserId: locals.user!.id, domainKey: space.domain, connectionMode, dorianMode }
    });
    return { saved: true };
  }
};
