// Stage 8.18 - Preferences are always owned by the selected workspace and user.
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { requireRelishWorkspace } from '$lib/server/core/relishWorkspace';
import { loadContextProfile } from '$lib/server/core/relishWorkspaceData';
import { setOwnedDefaultContextSpace } from '$lib/server/integrations/elevenlabs/phoneDefaultContext';

export const load: PageServerLoad = async ({ locals, params }) => {
  const space = await requireRelishWorkspace(locals, params.context);
  const preferences = await prisma.relishContextPreference.findUnique({ where: {
    ownerUserId_domainKey: { ownerUserId: locals.user!.id, domainKey: space.domain }
  } });
  const person = await prisma.user.findUnique({ where: { id: locals.user!.id },
    select: { defaultContextSpaceId: true } });
  return { isPrimaryContext: Boolean(locals.contextSpaceId && person?.defaultContextSpaceId === locals.contextSpaceId),
    hasPrimaryContext: Boolean(person?.defaultContextSpaceId), profile: space.configured ? await loadContextProfile(locals.user!.id, space.name) : null,
    connectionMode: preferences?.connectionMode || 'AUTOMATIC',
    dorianMode: preferences?.dorianMode || 'SMS_CALLBACK' };
};

export const actions: Actions = {
  setDefault: async ({ locals, params }) => {
    const space = await requireRelishWorkspace(locals, params.context);
    if (!space.configured || !locals.contextSpaceId) return fail(400, { error: 'This ContextSpace is not ready.' });
    const ok = await setOwnedDefaultContextSpace(locals.user!.id, locals.contextSpaceId);
    if (!ok) return fail(403, { error: 'You can only select a ContextSpace that you own.' });
    return { defaultSaved: true };
  },
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
