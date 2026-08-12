// PURPOSE: Handle POST to delete a contact and redirect to home.
// MULTI TENANT: Verifies the contact belongs to the current user before deleting.
// SECURITY: Never log decrypted PII. Keep logs minimal.

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url'; // IT: build an absolute URL using locals.appOrigin

export const POST: RequestHandler = async ({ locals, params }) => {
  // IT: require login
  if (!locals.user) {
    // IT: redirect to absolute login URL for safety across environments
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
  }

  const id = params.id;

  // IT: check ownership to avoid cross tenant deletes
  const owned = await prisma.contact.findFirst({
    where: { id, userId: locals.user.id },
    select: { id: true }
  });

  if (!owned) {
    // IT: silent fallback - return user to home
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/'));
  }

  try {
    // IT: if you have related rows without ON DELETE CASCADE, delete them here first inside a transaction
    // await prisma.$transaction([
    //   prisma.interaction.deleteMany({ where: { contactId: id, userId: locals.user.id } }),
    //   prisma.contactTag.deleteMany({ where: { contactId: id, userId: locals.user.id } }),
    //   prisma.contact.delete({ where: { id } })
    // ]);

    // IT: simple delete if FKs are cascaded or there are no children
    await prisma.contact.delete({ where: { id } });
  } catch (err) {
    // IT: log server side only - keep details private
    console.error('delete contact failed', err);
    // IT: still send the user home to avoid trapping them on a broken page
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/'));
  }

  // IT: success - absolute redirect to home so there is no localhost fallback
  throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/'));
};
