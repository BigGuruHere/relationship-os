// PURPOSE: View + delete a single interaction (note).
// - We keep your existing `load` (decrypting the note).
// - We add a `delete` action that removes the interaction and redirects to the contact page.

// src/routes/contacts/[id]/interactions/[iid]/+page.server.ts

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';

export const load = async ({ params }) => {
  // Fetch by both ids for safety (makes sure this interaction belongs to this contact)
  const row = await prisma.interaction.findFirst({
    where: { id: params.iid, contactId: params.id },
    select: { id: true, contactId: true, occurredAt: true, channel: true, rawTextEnc: true }
  });

  if (!row) return { notFound: true };

  let text = '';
  try {
    text = decrypt(row.rawTextEnc, 'interaction.raw_text');
  } catch {
    text = '⚠︎ Unable to decrypt note';
  }

  return {
    interaction: {
      id: row.id,
      contactId: row.contactId,
      occurredAt: row.occurredAt,
      channel: row.channel,
      text
    }
  };
};

// Add the delete action

export const actions = {
    delete: async ({ params }) => {
      // Only wrap the DB write in try/catch
      try {
        const res = await prisma.interaction.deleteMany({
          where: { id: params.iid, contactId: params.id }
        });
  
        if (res.count === 0) {
          return fail(404, { error: 'Interaction not found or already deleted.' });
        }
      } catch (err) {
        console.error('Failed to delete interaction (DB error):', err);
        return fail(500, { error: 'Failed to delete note. Please try again.' });
      }
  
      // Do the redirect AFTER the try/catch so it isn’t caught/logged
      throw redirect(303, `/contacts/${params.id}`);
    }
  };
