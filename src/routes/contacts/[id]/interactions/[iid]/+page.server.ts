// src/routes/contacts/[id]/interactions/[iid]/+page.server.ts
// PURPOSE: Load + decrypt one interaction for viewing (and link to edit)

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';

export const load = async ({ params }) => {
  // Fetch by both contactId and interaction id for safety
  const row = await prisma.interaction.findFirst({
    where: { id: params.iid, contactId: params.id },
    select: {
      id: true,
      contactId: true,
      occurredAt: true,
      channel: true,
      rawTextEnc: true
    }
  });

  if (!row) return { notFound: true };

  // Decrypt note body on the server
  let text = '';
  try {
    text = decrypt(row.rawTextEnc, 'interaction.raw_text'); // AAD must match write
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
