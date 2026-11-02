import { transcriptionDebugEnabled } from '$lib/server/transcriptionDiagnostics';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { requirePeopleContact } from '$lib/server/core/myPeople';
import { privateContactDetails } from '$lib/server/core/contacts';
import { createCoreInteraction } from '$lib/server/core/interactions';
export const load: PageServerLoad = async ({ locals, params }) => {
  const { contact } = await requirePeopleContact(locals, params.id);
  return { contact: privateContactDetails(contact), transcriptionDebug: transcriptionDebugEnabled() };
};
export const actions: Actions = {
  save: async ({ locals, params, request }) => {
    const { context, contact } = await requirePeopleContact(locals, params.id);
    const fd = await request.formData();
    const text = String(fd.get('text') || '').trim();
    const channel = fd.get('channel') === 'voice note' ? 'OWNER_VOICE_NOTE' : 'OWNER_NOTE';
    if (!text || text.length > 100000) return fail(400, { error: 'Enter a note of up to 100,000 characters.', draft: { text, channel: channel === 'OWNER_VOICE_NOTE' ? 'voice note' : 'note' } });
    // Authenticated owner authors an observation. Storage never implies LU, matching or disclosure permission.
    try {
      await createCoreInteraction(context, { contactId: contact.id, channel, rawText: text, sourceType: 'WORKSPACE', luAdmission: 'STORED_ONLY', createEmbedding: false });
    } catch {
      // Return the draft on storage failure; never log private observations.
      return fail(500, { error: 'Could not save your note. Your text is below; please retry.', draft: { text, channel: channel === 'OWNER_VOICE_NOTE' ? 'voice note' : 'note' } });
    }
    // A private observation does not imply a new conversation: leave lastContactedAt unchanged.
    throw redirect(303, '/people/' + contact.id);
  }
};
