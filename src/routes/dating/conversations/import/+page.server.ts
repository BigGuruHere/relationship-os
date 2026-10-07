// PURPOSE: Explicit preview and custody-scoped import of externally transcribed, permissioned conversations.
// Stage 8.14.1: manual paste/file import is one adapter into the provider-aware conversation source.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listDatingPeople } from '$lib/server/datingPilotDirectory';
import { parseDatingTranscript } from '$lib/server/datingTranscriptImportPolicy';
import { importDatingTranscript } from '$lib/server/datingTranscriptImport';
import { validateConversationMetadata } from '$lib/server/core/conversationIngestion';
import { getCurrentLivingUnderstanding } from '$lib/server/datingPersistedLivingUnderstanding';

function requireDating(locals: App.Locals) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) throw redirect(303, '/settings/context-spaces');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const scope = requireDating(locals);
  const people = await listDatingPeople(scope.userId, scope.contextSpaceId);
  const requestedPersonId = String(url.searchParams.get('personId') || '');
  return {
    people,
    selectedPersonId: people.some(person => person.id === requestedPersonId) ? requestedPersonId : ''
  };
};

function metadataFromForm(form: FormData) {
  return validateConversationMetadata({
    provider: form.get('provider'),
    ingestMethod: form.get('ingestMethod'),
    externalConversationId: form.get('externalConversationId'),
    agentName: form.get('agentName'),
    occurredAt: form.get('occurredAt')
  });
}

export const actions: Actions = {
  preview: async ({ locals, request }) => {
    requireDating(locals);
    const form = await request.formData();
    const transcript = String(form.get('transcript') || '');
    try {
      const parsed = parseDatingTranscript(transcript);
      const metadata = metadataFromForm(form);
      return {
        preview: {
          speakers: parsed.speakers,
          turnCount: parsed.turns.length,
          text: parsed.text,
          metadata: {
            provider: metadata.provider,
            ingestMethod: metadata.ingestMethod,
            externalConversationId: metadata.externalConversationId ?? '',
            agentName: metadata.agentName ?? '',
            occurredAt: metadata.occurredAt ? metadata.occurredAt.toISOString() : ''
          }
        }
      };
    } catch (error: any) {
      return fail(400, { error: error?.message || 'Invalid transcript.' });
    }
  },

  import: async ({ locals, request }) => {
    const scope = requireDating(locals);
    const form = await request.formData();
    if (form.get('retainConsent') !== 'YES') {
      return fail(400, { error: 'Confirm you have permission to retain this conversation and create private person sources.' });
    }
    const text = String(form.get('transcript') || '');
    try {
      const parsed = parseDatingTranscript(text);
      const mapping = Object.fromEntries(parsed.speakers.map((speaker, index) => [
        speaker,
        String(form.get(`speaker_${index}`) || '')
      ]));
      const imported = await importDatingTranscript(scope, text, mapping, {
        provider: form.get('provider'),
        ingestMethod: form.get('ingestMethod'),
        externalConversationId: form.get('externalConversationId'),
        agentName: form.get('agentName'),
        occurredAt: form.get('occurredAt')
      });

      const excerpts = await Promise.all(imported.excerpts.map(async excerpt => {
        if (!excerpt.contactId) return { ...excerpt, hasLivingUnderstanding: false, nextHref: '' };
        const living = await getCurrentLivingUnderstanding({
          userId: scope.userId,
          contextSpaceId: scope.contextSpaceId,
          contactId: excerpt.contactId
        });
        const nextHref = living
          ? `/dating/people/${excerpt.contactId}/understanding/impact-review?sourceInteractionId=${encodeURIComponent(excerpt.id)}`
          : `/dating/people/${excerpt.contactId}/understanding/initial?initial=1&sourceInteractionId=${encodeURIComponent(excerpt.id)}`;
        return { ...excerpt, hasLivingUnderstanding: Boolean(living), nextHref };
      }));

      return { imported: { ...imported, excerpts } };
    } catch (error: any) {
      return fail(400, { error: error?.message || 'The transcript could not be imported.' });
    }
  }
};
