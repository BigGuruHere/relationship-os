// PURPOSE: Operator-only topic-aware revision trial, with NO persistence of AI-generated changes.
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSourceReflection } from '$lib/server/datingLivingUnderstanding';
import { listUnderstandingTopics } from '$lib/server/datingUnderstandingTopics';
import { identifyAffectedTopicsReadOnly, revisionExperimentEnabled, reviseTopicReadOnly } from '$lib/server/datingUnderstandingRevisionExperiment';

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
  return {
    personId: params.id,
    sourceId: source?.id ?? '',
    sourceKind: source?.sourceKind ?? null,
    topics: tree.flatMap(realm => realm.topics.map(topic => ({ id: topic.id, label: `${realm.name} / ${topic.name}`, count: topic.claims.length })))
  };
};

function safeExperimentError(err: unknown) {
  if (err instanceof Error && /exceeds the experiment limit|too many|too large|disabled|OPENAI_API_KEY|Choose an authorised topic|not accessible|inventory/.test(err.message)) {
    return err.message;
  }
  return 'The experimental revision was unavailable or malformed. No stored knowledge was changed.';
}

export const actions: Actions = {
  analyseTopics: async ({ locals, params, request }) => {
    const scope = authorisedScope(locals, params.id);
    const form = await request.formData();
    if (form.get('consent') !== 'YES') return fail(400, { revisionError: 'Explicitly authorise sending the selected transcript and current topic inventory to the AI provider.' });
    const sourceId = String(form.get('sourceInteractionId') || '');
    try {
      const topicAnalysis = await identifyAffectedTopicsReadOnly(scope, sourceId);
      return { topicAnalysis };
    } catch (err) {
      return fail(502, { revisionError: safeExperimentError(err) });
    }
  },
  reviseTopics: async ({ locals, params, request }) => {
    const scope = authorisedScope(locals, params.id);
    const form = await request.formData();
    if (form.get('consent') !== 'YES') return fail(400, { revisionError: 'Explicitly authorise sending the selected transcript and selected topic claims to the AI provider.' });
    const sourceId = String(form.get('sourceInteractionId') || '');
    const topicIds = form.getAll('topicId').map(value => String(value)).filter(Boolean);
    if (!topicIds.length) return fail(400, { revisionError: 'Choose at least one affected topic to revise.' });
    if (topicIds.length > 6) return fail(400, { revisionError: 'Revise at most six topics in one experiment run.' });
    try {
      // IT: Revalidate each topic server-side. Turn IDs can only narrow to authorised target-speaker turns.
      const revisions = [];
      for (const topicId of [...new Set(topicIds)]) {
        const relevantTurnIds = form.getAll(`relevantTurnId:${topicId}`).map(value => String(value)).filter(Boolean);
        revisions.push(await reviseTopicReadOnly(scope, sourceId, topicId, relevantTurnIds));
      }
      return { revisions };
    } catch (err) {
      return fail(502, { revisionError: safeExperimentError(err) });
    }
  }
};
