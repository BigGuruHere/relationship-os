import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';

export const GET: RequestHandler = async ({ locals, params }) => {
  // IT: require login
  if (!locals.user) throw redirect(303, '/auth/login');

  // IT: verify note belongs to this user and capture contactId for redirect
  const note = await prisma.interaction.findFirst({
    where: { id: params.iid, userId: locals.user.id },
    select: { id: true, contactId: true }
  });
  if (!note) {
    return new Response('Note not found', { status: 404 });
  }

  const contactId = note.contactId;

  try {
    // IT: perform the delete
    await prisma.interaction.delete({ where: { id: note.id } });
  } catch (err) {
    console.error('delete note GET failed', err);
    return new Response('Failed to delete note', { status: 500 });
  }

  // IT: do the redirect outside the try-catch so it is not swallowed
  throw redirect(303, `/contacts/${contactId}`);
};
