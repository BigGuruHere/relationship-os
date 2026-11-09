import { listPersonNotes } from '$lib/server/foundation/evidence';
import { error, redirect } from '@sveltejs/kit';
import { peopleRouteDomain, foundationPage } from '$lib/server/foundation/peopleRouting';
import { resolveFoundationAccess } from '$lib/server/foundation/policy';
import { archiveSubject, readPerson } from '$lib/server/foundation/subjects';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decryptInteractionSummary } from '$lib/server/core/interactionEncryption';
import { CAPTURE_CHANNEL } from '$lib/server/core/contactCapture';
import { decrypt } from '$lib/crypto';
import { requirePeopleContact } from '$lib/server/core/myPeople';
import { privateContactDetails } from '$lib/server/core/contacts';
export const load: PageServerLoad = async ({ locals, params, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (await peopleRouteDomain(locals.user.id, '/people/' + params.id) === 'FOUNDATION') {
    const contact = await foundationPage(async () => readPerson(await resolveFoundationAccess(locals, 'READ'), params.id));
    const history = await foundationPage(async () => listPersonNotes(await resolveFoundationAccess(locals, 'READ_NOTES'), params.id, url?.searchParams.get('afterNote') || undefined));
    return { contact, origin: contact.origin, notes: history.notes, nextNote: history.next, foundation: true };
  }
  const { context, contact } = await requirePeopleContact(locals, params.id);
  const rows = await prisma.interaction.findMany({ where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId: contact.id },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { id: true, channel: true, rawTextEnc: true, summaryEnc: true, occurredAt: true } });
  const originRow = rows.find(row => row.channel === CAPTURE_CHANNEL);
  const origin = originRow ? JSON.parse(decrypt(originRow.rawTextEnc, 'interaction.raw_text')) : null;
  return { foundation: false, nextNote: null, origin: origin ? { submittedAt: origin.submittedAt as string, channel: 'Profile detail sharing' } : null, contact: privateContactDetails(contact), notes: rows.filter(row => row.channel !== CAPTURE_CHANNEL).map(row => ({ id: row.id, channel: row.channel, at: row.occurredAt.toISOString(), text: decrypt(row.rawTextEnc, 'interaction.raw_text'), summary: decryptInteractionSummary(row.summaryEnc) })) };
};

// Archive the existing owner-private person. This does not erase related evidence.
export const actions: Actions = {
  archive: async ({ locals, params }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    if (await peopleRouteDomain(locals.user.id, '/people/' + params.id) !== 'FOUNDATION') {
      throw error(404, 'Person unavailable.');
    }
    await foundationPage(async () => archiveSubject(await resolveFoundationAccess(locals, 'WRITE'), params.id, 'PERSON'));
    throw redirect(303, '/people');
  }
};
