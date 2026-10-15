// PURPOSE: Authenticated personal-QR connection to the two participants' General ContextSpaces.
// SECURITY: Never accept participant IDs or context IDs from the posted form.
import type { RequestHandler } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { createNetworkConnection } from '$lib/connections';

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const personal = await prisma.profile.findFirst({
    where: { slug: params.slug, kind: 'personal' },
    select: { id: true, userId: true }
  });
  if (!personal) throw error(404, 'Personal profile not found.');
  if (personal.userId === locals.user.id) throw error(400, 'You cannot connect to yourself.');
  if (!locals.contextSpaceId || locals.contextDomainKey !== 'general') {
    throw error(409, 'Your General ContextSpace must be available to connect.');
  }
  try {
    await createNetworkConnection(personal.id, personal.userId, locals.user.id);
  } catch (cause) {
    // SECURITY: Do not disclose another participant's private database details.
    console.error('Network connection failed', cause);
    throw error(409, 'Unable to complete Network connection. Check both General ContextSpaces.');
  }
  throw redirect(303, '/network?connected=1');
};
