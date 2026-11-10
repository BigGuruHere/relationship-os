import { appendOwnerNote, listPersonNotes, FoundationConflict } from '$lib/server/foundation/evidence';
import { error, fail, redirect } from '@sveltejs/kit';
import { peopleRouteDomain, foundationPage } from '$lib/server/foundation/peopleRouting';
import { resolveFoundationAccess } from '$lib/server/foundation/policy';
import { archiveSubject, readPerson } from '$lib/server/foundation/subjects';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decryptInteractionSummary, encryptInteractionSummary } from '$lib/server/core/interactionEncryption';
import { CAPTURE_CHANNEL } from '$lib/server/core/contactCapture';
import { decrypt, encrypt } from '$lib/crypto';
import { requirePeopleContact } from '$lib/server/core/myPeople';
import { privateContactDetails } from '$lib/server/core/contacts';
export const load: PageServerLoad = async ({ locals, params, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (await peopleRouteDomain(locals.user.id, '/people/' + params.id) === 'FOUNDATION') {
    const contact = await foundationPage(async () => readPerson(await resolveFoundationAccess(locals, 'READ'), params.id));
    const followup = url?.searchParams.get('afterExchange');
    if (followup === '1' || followup === 'received') {
      // The exchange prompt only needs the name and the link to the private recorder.
      return {
        contact: { id: contact.id, name: contact.name, email: '', phone: '' },
        origin: null, notes: [], nextNote: null, foundation: true, followup
      };
    }
    const history = await foundationPage(async () => listPersonNotes(await resolveFoundationAccess(locals, 'READ_NOTES'), params.id, url?.searchParams.get('afterNote') || undefined));
    return { contact, origin: contact.origin, notes: history.notes, nextNote: history.next, foundation: true, followup: null };
  }
  const { context, contact } = await requirePeopleContact(locals, params.id);
  const rows = await prisma.interaction.findMany({ where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId: contact.id },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { id: true, channel: true, rawTextEnc: true, summaryEnc: true, luAdmission: true, occurredAt: true } });
  const originRow = rows.find(row => row.channel === CAPTURE_CHANNEL);
  const origin = originRow ? JSON.parse(decrypt(originRow.rawTextEnc, 'interaction.raw_text')) : null;
  return { foundation: false, nextNote: null, origin: origin ? { submittedAt: origin.submittedAt as string, channel: 'Profile detail sharing' } : null, contact: privateContactDetails(contact), followup: null, notes: rows.filter(row => row.channel !== CAPTURE_CHANNEL).map(row => ({ id: row.id, version: 0, editable: row.luAdmission === 'STORED_ONLY' && ['OWNER_NOTE', 'OWNER_VOICE_NOTE'].includes(row.channel), channel: row.channel, at: row.occurredAt.toISOString(), text: decrypt(row.rawTextEnc, 'interaction.raw_text'), summary: decryptInteractionSummary(row.summaryEnc) })) };
};

// Archive the existing owner-private person. This does not erase related evidence.
export const actions: Actions = {
  editNote: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const fields = await request.formData();
    const id = String(fields.get('noteId') || '');
    const text = String(fields.get('text') || '').trim();
    const summary = String(fields.get('summary') || '').trim();
    const utcTime = String(fields.get('occurredAt') || '');
    const occurredAt = new Date(utcTime + 'Z');
    const version = Number(fields.get('version'));
    const draft = { id, text, summary, utcTime, version };
    if (!id || !text || text.length > 64000 || summary.length > 20000 ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(utcTime) ||
        !Number.isFinite(occurredAt.getTime()))
      return fail(400, { error: 'Enter note text and a valid date and time.', draft });

    if (await peopleRouteDomain(locals.user.id, '/people/' + params.id) === 'FOUNDATION') {
      if (!Number.isSafeInteger(version) || version < 1) return fail(400, { error: 'Reload the note and try again.', draft });
      const end = Math.min(text.length, 8000);
      const quote = text.slice(0, end).replace(/[\uD800-\uDBFF]$/, '');
      try {
        await appendOwnerNote(await resolveFoundationAccess(locals, 'RECORD_EVIDENCE'), {
          key: 'person-note-edit:' + id, expectedVersion: version,
          text, summary, occurredAt: occurredAt.toISOString(), subjectIds: [params.id],
          captureKind: fields.get('channel') === 'OWNER_VOICE_NOTE' ? 'VOICE_NOTE' : 'OWNER_NOTE',
          start: 0, end: quote.length, quote
        }, id);
      } catch (e) {
        if (e instanceof FoundationConflict)
          return fail(409, { error: 'The note changed. Copy your edits and reload before trying again.', draft });
        return fail(400, { error: 'This note could not be edited.', draft });
      }
    } else {
      const { context, contact } = await requirePeopleContact(locals, params.id);
      const result = await prisma.interaction.updateMany({
        where: { id, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId,
          contactId: contact.id, channel: { in: ['OWNER_NOTE', 'OWNER_VOICE_NOTE'] }, luAdmission: 'STORED_ONLY' },
        data: { rawTextEnc: encrypt(text, 'interaction.raw_text'), summaryEnc: encryptInteractionSummary(summary), occurredAt }
      });
      if (!result.count) return fail(404, { error: 'Note not found.', draft });
    }
    throw redirect(303, '/people/' + encodeURIComponent(params.id));
  },
  archive: async ({ locals, params }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    if (await peopleRouteDomain(locals.user.id, '/people/' + params.id) !== 'FOUNDATION') {
      throw error(404, 'Person unavailable.');
    }
    await foundationPage(async () => archiveSubject(await resolveFoundationAccess(locals, 'WRITE'), params.id, 'PERSON'));
    throw redirect(303, '/people');
  }
};
