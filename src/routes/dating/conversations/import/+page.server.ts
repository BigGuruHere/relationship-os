// PURPOSE: Explicit preview and custody-scoped import of externally transcribed, permissioned conversations.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listDatingPeople } from '$lib/server/datingPilotDirectory';
import { parseDatingTranscript } from '$lib/server/datingTranscriptImportPolicy';
import { importDatingTranscript } from '$lib/server/datingTranscriptImport';
function requireDating(locals: App.Locals) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) throw redirect(303, '/settings/context-spaces');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}
export const load: PageServerLoad = async ({ locals }) => {
  const scope = requireDating(locals);
  return { people: await listDatingPeople(scope.userId, scope.contextSpaceId) };
};
export const actions: Actions = {
  preview: async ({ locals, request }) => {
    requireDating(locals);
    const form = await request.formData();
    const transcript = String(form.get('transcript') || '');
    try {
      const parsed = parseDatingTranscript(transcript);
      return { preview: { speakers: parsed.speakers, turnCount: parsed.turns.length, text: parsed.text } };
    } catch (error: any) { return fail(400, { error: error?.message || 'Invalid transcript.' }); }
  },
  import: async ({ locals, request }) => {
    const scope = requireDating(locals);
    const form = await request.formData();
    if (form.get('retainConsent') !== 'YES') return fail(400, { error: 'Confirm you have permission to retain this conversation and create private excerpts.' });
    const text = String(form.get('transcript') || '');
    try {
      const parsed = parseDatingTranscript(text);
      const mapping = Object.fromEntries(parsed.speakers.map((speaker, index) => [speaker, String(form.get(`speaker_${index}`) || '')]));
      const imported = await importDatingTranscript(scope, text, mapping);
      return { imported };
    } catch (error: any) { return fail(400, { error: error?.message || 'The transcript could not be imported.' }); }
  }
};
