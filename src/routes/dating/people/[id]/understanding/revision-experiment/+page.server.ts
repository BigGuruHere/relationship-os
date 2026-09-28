// PURPOSE: Operator-only side-by-side revision trial, with NO persistence of AI-generated changes.
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSourceReflection } from '$lib/server/datingLivingUnderstanding';
import { listUnderstandingTopics } from '$lib/server/datingUnderstandingTopics';
import { revisionExperimentEnabled, reviseTopicReadOnly } from '$lib/server/datingUnderstandingRevisionExperiment';

function authorisedScope(locals: App.Locals, id: string) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) throw error(403, 'Select a Dating ContextSpace.');
  if (!revisionExperimentEnabled()) throw error(404, 'Experiment is not enabled.');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId, contactId: id };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const scope = authorisedScope(locals, params.id);
  const sourceId = String(url.searchParams.get('sourceInteractionId') || '');
  const [tree, source] = await Promise.all([
    listUnderstandingTopics(scope),
    sourceId ? requireSourceReflection(scope, sourceId) : Promise.resolve(null)
  ]);
  return { personId: params.id, sourceId: source?.id ?? '',
    sourceKind: source?.sourceKind ?? null,
    topics: tree.flatMap(realm => realm.topics.map(topic => ({ id: topic.id, label: `${realm.name} / ${topic.name}`, count: topic.claims.length }))) };
};

export const actions: Actions = {
  run: async ({ locals, params, request }) => {
    const scope = authorisedScope(locals, params.id);
    const form = await request.formData();
    if (form.get('consent') !== 'YES') return fail(400, { revisionError: 'Explicitly authorise sending the selected transcript and topic claims to the AI provider.' });
    const sourceId = String(form.get('sourceInteractionId') || '');
    const topicId = String(form.get('topicId') || '');
    try {
      const revision = await reviseTopicReadOnly(scope, sourceId, topicId);
      return { revision };
    } catch (err) {
      // IT: No raw model error, transcript, private statement or API response is logged or reflected to the UI.
      if (err instanceof Error && /exceeds the experiment limit|contains too many claims|too large for this experiment|disabled|OPENAI_API_KEY|Choose an authorised topic|not accessible/.test(err.message)) {
        return fail(400, { revisionError: err.message });
      }
      return fail(502, { revisionError: 'The experimental revision was unavailable or malformed. No stored knowledge was changed.' });
    }
  }
};
