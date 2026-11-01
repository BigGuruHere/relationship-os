import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { requirePeopleContact } from '$lib/server/core/myPeople';
import { privateContactDetails } from '$lib/server/core/contacts';
export const load: PageServerLoad = async ({ locals, params }) => {
  const { context, contact } = await requirePeopleContact(locals, params.id);
  const rows = await prisma.interaction.findMany({ where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId: contact.id },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { id: true, channel: true, rawTextEnc: true, occurredAt: true } });
  return { contact: privateContactDetails(contact), notes: rows.map(row => ({ id: row.id, channel: row.channel, at: row.occurredAt.toISOString(), text: decrypt(row.rawTextEnc, 'interaction.raw_text') })) };
};
