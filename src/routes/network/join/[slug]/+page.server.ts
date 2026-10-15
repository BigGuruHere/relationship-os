// PURPOSE: A new or existing member can return to an inviter after authentication.
// SECURITY: The invitation identifies a public Personal profile, never a client-supplied user id.
import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { createNetworkConnection } from '$lib/connections';
import { ensureOwnedDomainContextSpace } from '$lib/server/core/contextSpaceDirectory';
import { runWithWorkspaceCustody } from '$lib/server/core/contextSpace';

export const load: PageServerLoad = async ({ params, locals }) => {
  const profile = await prisma.profile.findFirst({
    where: { slug: params.slug, kind: 'personal' },
    select: { id: true, userId: true, displayName: true, slug: true }
  });
  if (!profile) throw error(404, 'Network invitation not found.');
  const next = `/network/join/${encodeURIComponent(profile.slug)}`;
  if (!locals.user) return { profile: { name: profile.displayName || 'Network member' }, signedIn: false, isSelf: false, connected: false, next };
  const isSelf = locals.user.id === profile.userId;
  const connected = isSelf ? false : Boolean(await prisma.networkConnectionOrigin.findFirst({
    where: { OR: [
      { inviterUserId: profile.userId, visitorUserId: locals.user.id },
      { inviterUserId: locals.user.id, visitorUserId: profile.userId }
    ] }, select: { id: true }
  }));
  return { profile: { name: profile.displayName || 'Network member' }, signedIn: true, isSelf, connected, next };
};

export const actions: Actions = {
  connect: async ({ locals, params }) => {
    if (!locals.user) throw redirect(303, `/auth/register?next=${encodeURIComponent(`/network/join/${params.slug}`)}`);
    const personal = await prisma.profile.findFirst({
      where: { slug: params.slug, kind: 'personal' }, select: { id: true, userId: true }
    });
    if (!personal) return fail(404, { error: 'Invitation not found.' });
    if (personal.userId === locals.user.id) return fail(400, { error: 'You cannot connect with yourself.' });

    // A registered member may not yet have a General workspace. Provision their own
    // workspace explicitly, without granting cross-user administrative access.
    const general = await ensureOwnedDomainContextSpace(prisma, {
      ownerUserId: locals.user.id, domainKey: 'general', displayName: 'General'
    });
    try {
      // Network connection requires workspace custody even if the current request
      // resolved a Business context. Re-enter with the verified General workspace.
      await runWithWorkspaceCustody({ userId: locals.user.id, contextSpaceId: general.id },
        () => createNetworkConnection(personal.id, personal.userId, locals.user!.id));
    } catch (cause) {
      console.error('Network invitation connection failed', cause);
      return fail(409, { error: 'Unable to connect at present. Please try again.' });
    }
    throw redirect(303, '/network?connected=1');
  }
};
