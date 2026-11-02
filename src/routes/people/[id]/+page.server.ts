import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decryptInteractionSummary } from '$lib/server/core/interactionEncryption';
import { CAPTURE_CHANNEL } from '$lib/server/core/contactCapture';
import { decrypt } from '$lib/crypto';
import { requirePeopleContact } from '$lib/server/core/myPeople';
import { privateContactDetails } from '$lib/server/core/contacts';
export const load: PageServerLoad = async ({ locals, params }) => {
  const { context, contact } = await requirePeopleContact(locals, params.id);
  const rows = await prisma.interaction.findMany({ where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId: contact.id },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { id: true, channel: true, rawTextEnc: true, summaryEnc: true, occurredAt: true } });
  const originRow = rows.find(row => row.channel === CAPTURE_CHANNEL);
  const origin = originRow ? JSON.parse(decrypt(originRow.rawTextEnc, 'interaction.raw_text')) : null;
  return { origin: origin ? { submittedAt: origin.submittedAt as string, channel: 'Profile detail sharing' } : null, contact: privateContactDetails(contact), notes: rows.filter(row => row.channel !== CAPTURE_CHANNEL).map(row => ({ id: row.id, channel: row.channel, at: row.occurredAt.toISOString(), text: decrypt(row.rawTextEnc, 'interaction.raw_text'), summary: decryptInteractionSummary(row.summaryEnc) })) };
};
