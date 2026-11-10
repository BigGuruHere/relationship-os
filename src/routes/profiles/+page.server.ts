// Profile manager: list every owned profile instead of collapsing to one record per kind.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { exchangeBrowserEnabled } from '$lib/server/foundation/devPilotGate';
import { accountDomain } from '$lib/server/foundation/provisioning';
export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const profiles = await prisma.profile.findMany({ where: {
    userId: locals.user.id
  }, select: { id: true, label: true, slug: true, displayName: true, headline: true, isPublished: true, isDefault: true },
  orderBy: { updatedAt: 'desc' } });
  const channelsAvailable = exchangeBrowserEnabled(locals, url.origin)
    && await accountDomain(locals.user.id) === 'ACTIVE';
  return { channelsAvailable, profiles };
};
