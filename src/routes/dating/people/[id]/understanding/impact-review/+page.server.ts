// Stage 8.13.1 - production review of one new source against the authoritative Living Understanding.
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSourceReflection } from '$lib/server/datingLivingUnderstanding';
import { getAuthoritativeLivingUnderstandingBaseline, describeLivingUnderstandingPersistenceError } from '$lib/server/datingPersistedLivingUnderstanding';
import { reviewLivingUnderstandingImpact, approveLivingUnderstandingImpact, sourceAlreadyInAuthoritativeLivingUnderstanding } from '$lib/server/datingLongitudinalLivingUnderstanding';
import { saveLivingUnderstandingDraft, completeLivingUnderstandingDraft } from '$lib/server/datingLivingUnderstandingDraft';

function scopeFor(locals: App.Locals, contactId: string) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) throw error(403, 'Select a Dating ContextSpace.');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId, contactId };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const scope = scopeFor(locals, params.id);
  const sourceInteractionId = String(url.searchParams.get('sourceInteractionId') || '');
  if (!sourceInteractionId) throw error(400, 'Choose a reflection or conversation excerpt to review.');
  const [source, baseline, alreadyApplied] = await Promise.all([
    requireSourceReflection(scope, sourceInteractionId),
    getAuthoritativeLivingUnderstandingBaseline(scope),
    sourceAlreadyInAuthoritativeLivingUnderstanding(scope, sourceInteractionId)
  ]);
  if (!baseline) throw redirect(303, `/dating/people/${params.id}/understanding?sourceInteractionId=${encodeURIComponent(sourceInteractionId)}`);
  return {
    personId: params.id,
    source: { id: source.id, at: source.at.toISOString(), sourceKind: source.sourceKind, text: source.text, speaker: source.speaker },
    baseline: {
      id: baseline.id,
      revisionNumber: baseline.revisionNumber,
      authorisedAt: baseline.authorisedAt.toISOString(),
      topics: baseline.topics.map(topic => ({ topicIdentityId: topic.topicIdentityId, topicVersionId: topic.topicVersionId, topicVersionNumber: topic.topicVersionNumber, realm: topic.realm, topicName: topic.topicName, understanding: topic.understanding }))
    },
    alreadyApplied
  };
};

function safeError(err: unknown) {
  const message = err instanceof Error ? err.message : '';
  if (/OPENAI_API_KEY|authoritative Living Understanding|already part|does not materially|too large|omitted|unknown or repeated|lacks valid|STALE_BASELINE/.test(message)) return message;
  return 'Living Understanding impact review could not be completed. No authoritative knowledge was changed.';
}

export const actions: Actions = {
  analyseImpact: async ({ locals, params, request }) => {
    const scope = scopeFor(locals, params.id);
    const form = await request.formData();
    if (form.get('consent') !== 'YES') return fail(400, { impactError: 'Explicitly authorise AI processing of this private source and current authoritative Living Understanding.' });
    const sourceInteractionId = String(form.get('sourceInteractionId') || '');
    try {
      const proposal = await reviewLivingUnderstandingImpact(scope, sourceInteractionId);
      const draftCheckpoint = await saveLivingUnderstandingDraft(scope, 'IMPACT_REVIEW_READY', {
        longitudinalSeed: [{
          targetKey: `authoritative-revision:${proposal.baselineRevisionId}`,
          topicName: `Authoritative v${proposal.baselineRevisionNumber} impact review`,
          proposedUnderstanding: `Review proposes ${proposal.affectedTopics.length} affected topic(s) and ${proposal.newTopics.length} new topic(s).`,
          sourceInteractionId,
          sourceInteractionIds: [sourceInteractionId]
        }],
        priorOperationalUnits: [],
        chainHistory: []
      }, '', {
        sourceInteractionId,
        baselineRevisionId: proposal.baselineRevisionId,
        baselineRevisionNumber: proposal.baselineRevisionNumber
      });
      return { impactProposal: proposal, draftCheckpoint };
    } catch (err) {
      // Stage 8.13.3.2: keep production errors deliberately generic, but make
      // development failures observable so semantic/provider defects can be
      // diagnosed without weakening the fail-closed review path.
      if (process.env.NODE_ENV !== 'production') {
        console.error('[living-understanding] impact analysis failed', err);
        const diagnostic = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        return fail(502, { impactError: `${safeError(err)} (${diagnostic})` });
      }
      return fail(502, { impactError: safeError(err) });
    }
  },

  approveImpact: async ({ locals, params, request }) => {
    const scope = scopeFor(locals, params.id);
    const form = await request.formData();
    if (form.get('approve') !== 'YES') return fail(400, { impactError: 'Explicitly approve the reviewed topic changes before saving them.' });
    try {
      await approveLivingUnderstandingImpact(scope, String(form.get('approvalToken') || ''));
      await completeLivingUnderstandingDraft(scope, String(form.get('draftCheckpointId') || ''));
    } catch (err) {
      const diagnostic = process.env.NODE_ENV !== 'production' ? describeLivingUnderstandingPersistenceError(err) : '';
      return fail(400, { impactError: diagnostic ? `${safeError(err)} (${diagnostic})` : safeError(err) });
    }
    throw redirect(303, `/dating/people/${params.id}/understanding?livingSaved=1`);
  }
};
