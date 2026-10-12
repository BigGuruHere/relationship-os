// PURPOSE: Explicit preview and custody-scoped import of General-context conversations.
// SECURITY: The route-owned General ContextSpace is rechecked before every import.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listContextPeople } from '$lib/server/core/participantDirectory';
import { parseDatingTranscript } from '$lib/server/datingTranscriptImportPolicy';
import { importConversationTranscript } from '$lib/server/datingTranscriptImport';
import { validateConversationMetadata } from '$lib/server/core/conversationIngestion';
import { getCurrentLivingUnderstanding } from '$lib/server/datingPersistedLivingUnderstanding';
import { listPendingConversations, storeConversationOriginal, attachConversationParticipant } from '$lib/server/core/conversationInbox';
import { fetchElevenLabsConversation, normalizeElevenLabsConversation } from '$lib/server/integrations/elevenlabs/conversation';

function requireGeneral(locals: App.Locals) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'general' || !locals.contextSpaceId) throw redirect(303, '/settings/context-spaces');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const scope = requireGeneral(locals);
  const people = await listContextPeople(scope, 'general');
  const requestedPersonId = String(url.searchParams.get('personId') || '');
  const pendingConversations = await listPendingConversations(scope, 'general');
  return { people, pendingConversations, contextSpaceId: scope.contextSpaceId, selectedPersonId: people.some(person => person.id === requestedPersonId) ? requestedPersonId : '', elevenLabsApiConfigured: Boolean(process.env.ELEVENLABS_API_KEY) };
};

function metadataFromForm(form: FormData) {
  return validateConversationMetadata({
    provider: form.get('provider'), ingestMethod: form.get('ingestMethod'),
    externalConversationId: form.get('externalConversationId'), agentName: form.get('agentName'), occurredAt: form.get('occurredAt')
  });
}

export const actions: Actions = {


  fetchElevenLabs: async ({ locals, request }) => {
    const scope = requireGeneral(locals);
    const form = await request.formData();
    const conversationId = String(form.get('conversationId') || '').trim();
    const contactId = String(form.get('contactId') || '').trim();
    try {
      const providerData = await fetchElevenLabsConversation(conversationId);
      const normalized = normalizeElevenLabsConversation(providerData, 'ELEVENLABS_API');
      const stored = await storeConversationOriginal(scope, 'general', normalized.parsed, normalized.metadata);
      let attached: any = null;
      if (contactId) attached = await attachConversationParticipant(scope, 'general', stored.transcriptId, contactId);
      let nextHref = '';
      let hasLivingUnderstanding = false;
      if (attached?.contactId) {
        const living = await getCurrentLivingUnderstanding({ userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: attached.contactId });
        hasLivingUnderstanding = Boolean(living);
        nextHref = living
          ? `/general/people/${attached.contactId}/understanding/impact-review?sourceInteractionId=${encodeURIComponent(attached.id)}`
          : `/general/people/${attached.contactId}/understanding/initial?initial=1&sourceInteractionId=${encodeURIComponent(attached.id)}`;
      }
      return { directImported: { transcriptId: stored.transcriptId, alreadyImported: stored.alreadyImported, attached, nextHref, hasLivingUnderstanding, conversationId: normalized.metadata.externalConversationId } };
    } catch (error: any) {
      return fail(400, { error: error?.message || 'The ElevenLabs conversation could not be fetched.' });
    }
  },

  attachPending: async ({ locals, request }) => {
    const scope = requireGeneral(locals);
    const form = await request.formData();
    const transcriptId = String(form.get('transcriptId') || '').trim();
    const contactId = String(form.get('contactId') || '').trim();
    try {
      const attached = await attachConversationParticipant(scope, 'general', transcriptId, contactId);
      const living = await getCurrentLivingUnderstanding({ userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId });
      const nextHref = living
        ? `/general/people/${contactId}/understanding/impact-review?sourceInteractionId=${encodeURIComponent(attached.id)}`
        : `/general/people/${contactId}/understanding/initial?initial=1&sourceInteractionId=${encodeURIComponent(attached.id)}`;
      return { pendingAttached: { ...attached, nextHref, hasLivingUnderstanding: Boolean(living) } };
    } catch (error: any) {
      return fail(400, { error: error?.message || 'The conversation could not be attached to that participant.' });
    }
  },
  preview: async ({ locals, request }) => {
    requireGeneral(locals);
    const form = await request.formData();
    const transcript = String(form.get('transcript') || '');
    try {
      const parsed = parseDatingTranscript(transcript);
      const metadata = metadataFromForm(form);
      return { preview: { speakers: parsed.speakers, turnCount: parsed.turns.length, text: parsed.text, metadata: {
        provider: metadata.provider, ingestMethod: metadata.ingestMethod,
        externalConversationId: metadata.externalConversationId ?? '', agentName: metadata.agentName ?? '',
        occurredAt: metadata.occurredAt ? metadata.occurredAt.toISOString() : ''
      } } };
    } catch (error: any) { return fail(400, { error: error?.message || 'Invalid transcript.' }); }
  },

  import: async ({ locals, request }) => {
    const scope = requireGeneral(locals);
    const form = await request.formData();
    if (form.get('retainConsent') !== 'YES') return fail(400, { error: 'Confirm you have permission to retain this conversation and create private person sources.' });
    const text = String(form.get('transcript') || '');
    try {
      const parsed = parseDatingTranscript(text);
      const mapping = Object.fromEntries(parsed.speakers.map((speaker, index) => [speaker, String(form.get(`speaker_${index}`) || '')]));
      const imported = await importConversationTranscript(scope, 'general', text, mapping, {
        provider: form.get('provider'), ingestMethod: form.get('ingestMethod'), externalConversationId: form.get('externalConversationId'),
        agentName: form.get('agentName'), occurredAt: form.get('occurredAt')
      });
      const excerpts = await Promise.all(imported.excerpts.map(async excerpt => {
        if (!excerpt.contactId) return { ...excerpt, hasLivingUnderstanding: false, nextHref: '' };
        const living = await getCurrentLivingUnderstanding({ userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: excerpt.contactId });
        const nextHref = living
          ? `/general/people/${excerpt.contactId}/understanding/impact-review?sourceInteractionId=${encodeURIComponent(excerpt.id)}`
          : `/general/people/${excerpt.contactId}/understanding/initial?initial=1&sourceInteractionId=${encodeURIComponent(excerpt.id)}`;
        return { ...excerpt, hasLivingUnderstanding: Boolean(living), nextHref };
      }));
      return { imported: { ...imported, excerpts } };
    } catch (error: any) { return fail(400, { error: error?.message || 'The transcript could not be imported.' }); }
  }
};
