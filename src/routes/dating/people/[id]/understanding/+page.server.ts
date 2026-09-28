// PURPOSE: Stage 8.12.0 - participant-specific Living Understanding pilot.
// SECURITY: Require the request's Dating ContextSpace and scope every operation by owner + context + contact.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { suggestDatingKnowledge } from '$lib/server/datingKnowledgeExtraction';
import { sourceEvidenceMatch } from '$lib/server/knowledgeSuggestionQuality';
import { REALMS, possibleRealmHint, listUnderstandingTopics, createUnderstandingTopic, assignKnowledgeTopic, unassignKnowledgeTopic, requireDatingPerson } from '$lib/server/datingUnderstandingTopics';
import { suggestTopicPlacement } from '$lib/server/datingTopicPlacement';
import { compareDatingKnowledge, listDatingKnowledgeComparisons, sharedTopicCandidates } from '$lib/server/datingKnowledgeComparison';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { listDatingUnderstanding, createDatingUnderstanding, reviewDatingUnderstanding, listCurrentDatingKnowledge, requireSourceReflection, validateUnderstandingStatement } from '$lib/server/datingLivingUnderstanding';

function requireDating(locals: App.Locals, contactId: string) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) throw redirect(303, '/settings/context-spaces');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId, contactId };
}
export const load: PageServerLoad = async ({ locals, params, url }) => {
  const scope = requireDating(locals, params.id);
  const contact = await prisma.contact.findFirst({ where: { id: scope.contactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId }, select: { id: true, fullNameEnc: true } });
  if (!contact) throw redirect(303, '/dating/people');
  const sourceId = url.searchParams.get('sourceInteractionId');
  // Validate the optional preselected source rather than trusting query parameters.
  const selectedSource = sourceId ? await requireSourceReflection(scope, sourceId) : null;
  const currentKnowledge = await listCurrentDatingKnowledge(scope);
  const topicTree = await listUnderstandingTopics(scope);
  const availableTopics = topicTree.flatMap(realm => realm.topics.map(topic => ({ id: topic.id, name: topic.name, realmKey: realm.key, realmName: realm.name })));
  const namedKnowledge = currentKnowledge.map(claim => {
    const hintKey = possibleRealmHint(claim.kind, claim.statement);
    return { ...claim, possibleRealm: hintKey ? REALMS.find(r => r.key === hintKey)?.name ?? null : null, suggestedTopics: suggestTopicPlacement(claim.statement, claim.kind, availableTopics) };
  });
  // Only active, same-person claims that share a topic are shown as comparison candidates.
  const comparisonCandidates = Object.fromEntries(namedKnowledge.map(claim => [claim.id,
    sharedTopicCandidates(topicTree, claim.id).map(candidate => ({ ...candidate,
      statement: namedKnowledge.find(item => item.id === candidate.id)?.statement ?? '',
      createdAt: namedKnowledge.find(item => item.id === candidate.id)?.createdAt ?? null }))
      .filter(candidate => candidate.statement)]));
  const comparisonHistory = await listDatingKnowledgeComparisons(scope);
  const focusClaimId = url.searchParams.get('claimId');
  // After a saved review, open the most recently updated unassigned claim, if one exists.
  const assignedIds = new Set(topicTree.flatMap(realm => realm.topics.flatMap(topic => topic.claims.map(claim => claim.id))));
  const suggestedFocusClaimId = url.searchParams.get('reviewSaved') === '1'
    ? namedKnowledge.find(claim => !assignedIds.has(claim.id))?.id ?? null : null;
  return { personId: scope.contactId, focusClaimId: namedKnowledge.some(claim => claim.id === focusClaimId) ? focusClaimId : null, suggestedFocusClaimId, name: await contactDisplayName(contact),
    reviewSaved: url.searchParams.get('reviewSaved') === '1', entries: await listDatingUnderstanding(scope), currentKnowledge: namedKnowledge,
    realms: REALMS, topicTree, selectedSource, comparisonCandidates, comparisonHistory, comparisonSaved: url.searchParams.get('comparisonSaved') === '1' }; 
};
export const actions: Actions = {
  compareKnowledge: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    const newerClaimId = String(form.get('newerClaimId') || '');
    try {
      await compareDatingKnowledge(scope, { newerClaimId,
        olderClaimId: String(form.get('olderClaimId') || ''),
        relationship: String(form.get('relationship') || ''),
        note: String(form.get('note') || ''),
        acknowledgeSupersession: form.get('acknowledgeSupersession') === 'YES' });
    } catch (error: any) { return fail(400, { comparisonError: error?.message || 'Unable to compare statements.' }); }
    throw redirect(303, `/dating/people/${params.id}/understanding?claimId=${encodeURIComponent(newerClaimId)}&comparisonSaved=1#compare-knowledge`);
  },
  createTopic: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    try { await createUnderstandingTopic(scope, String(form.get('realmKey') || ''), form.get('topicName')); }
    catch (error: any) { return fail(400, { topicError: error?.message || 'Unable to create topic.' }); }
    throw redirect(303, `/dating/people/${params.id}/understanding#realms`);
  },
  assignTopic: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    try { await assignKnowledgeTopic(scope, String(form.get('claimId') || ''), String(form.get('topicId') || '')); }
    catch (error: any) { return fail(400, { topicError: error?.message || 'Unable to assign knowledge.' }); }
    const focusClaimId = String(form.get('focusClaimId') || '');
    throw redirect(303, `/dating/people/${params.id}/understanding?claimId=${encodeURIComponent(focusClaimId)}#assign-knowledge`);
  },
  // This is an explicit operator action, never implicit AI assignment.
  createAndAssignTopic: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    const claimId = String(form.get('claimId') || '');
    try {
      await requireDatingPerson(scope);
      // Validate the claim before creating a topic, to avoid orphan topics on invalid submissions.
      const claim = await prisma.knowledgeClaim.findFirst({ where: { id: claimId, ...scope, status: 'ACTIVE' }, select: { id: true } });
      if (!claim) throw new Error('Active knowledge was not found for this person.');
      const topic = await createUnderstandingTopic(scope, String(form.get('realmKey') || ''), form.get('topicName'));
      await assignKnowledgeTopic(scope, claimId, topic.id);
    } catch (error: any) { return fail(400, { topicError: error?.message || 'Unable to create and assign topic.' }); }
    throw redirect(303, `/dating/people/${params.id}/understanding?claimId=${encodeURIComponent(claimId)}#assign-knowledge`);
  },
  removeTopic: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    try { await unassignKnowledgeTopic(scope, String(form.get('claimId') || ''), String(form.get('topicId') || '')); }
    catch (error: any) { return fail(400, { topicError: error?.message || 'Unable to remove assignment.' }); }
    throw redirect(303, `/dating/people/${params.id}/understanding#realms`);
  },
  saveSuggestions: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    const sourceId = String(form.get('sourceInteractionId') || '');
    try {
      const source = await requireSourceReflection(scope, sourceId);
      const count = Number(form.get('count'));
      if (!Number.isInteger(count) || count < 1 || count > 32) throw new Error('Invalid number of suggestions.');
      const normalize = (v: string) => v.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
      const proposed = [] as { statement: string; kind: string; decision: string; quote: string }[];
      const seen = new Set<string>();
      for (let i = 0; i < count; i++) {
        const decision = String(form.get(`decision_${i}`) || 'SKIP');
        if (decision === 'SKIP') continue;
        if (!['PENDING', 'CONFIRMED', 'DEFERRED', 'REJECTED'].includes(decision)) throw new Error('Invalid review decision.');
        const kind = String(form.get(`kind_${i}`) || '');
        if (!['FACT','WANT','OFFER','PREFERENCE','CONSTRAINT','OBJECTIVE','OTHER'].includes(kind)) throw new Error('Invalid knowledge type.');
        const statement = validateUnderstandingStatement(form.get(`statement_${i}`));
        const quote = String(form.get(`evidence_${i}`) || '').trim();
        if (!quote || quote.length > 800 || !sourceEvidenceMatch(source.text, quote)) throw new Error('Missing or invalid supporting passage.');
        const fingerprint = `${kind}:${normalize(statement)}`;
        if (!seen.has(fingerprint)) { proposed.push({ statement, kind, decision, quote }); seen.add(fingerprint); }
      }
      // Repeated submissions must not create duplicate proposals from the same source.
      const existing = await listDatingUnderstanding(scope);
      const existingKeys = new Set(existing.filter(item => item.sourceInteractionId === sourceId)
        .map(item => `${item.kind}:${normalize(item.reviewedStatement ?? item.statement)}`));
      for (const item of proposed) {
        const fingerprint = `${item.kind}:${normalize(item.statement)}`;
        if (existingKeys.has(fingerprint)) continue;
        await createDatingUnderstanding(scope, {
          statement: item.statement, kind: item.kind, decision: item.decision,
          sourceInteractionId: sourceId, proposedBy: 'DORIAN', note: `AI suggested; source quote: ${item.quote.slice(0, 750)}`
        });
        existingKeys.add(fingerprint);
      }
    } catch (error: any) {
      return fail(400, { error: error?.message || 'Could not save reviewed suggestions.' });
    }
    throw redirect(303, `/dating/people/${params.id}/understanding?reviewSaved=1#current-knowledge`);
  },
  suggest: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    const sourceInteractionId = String(form.get('sourceInteractionId') || '');
    // External model processing requires explicit consent to submit this reflection.
    if (form.get('allowModelProcessing') !== 'YES') return fail(400, { suggestionError: 'Confirm permission to process this private reflection.' });
    try {
      const { suggestions, diagnostics } = await suggestDatingKnowledge(scope, sourceInteractionId);
      return { suggestions, diagnostics, suggestionSourceId: sourceInteractionId };
    } catch (error: any) {
      // Provider errors stay generic: do not return private transcript or upstream error text.
// Development-only diagnostics: display the provider error without
// logging the private transcript or complete request.
if (process.env.NODE_ENV !== 'production') {
  console.error('[dating knowledge suggestions] failed', {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : 'Unknown error'
  });
}      return fail(400, { suggestionError: 'Suggestions could not be generated. You can still add knowledge manually.' });
    }
  },
  propose: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    try { await createDatingUnderstanding(scope, { statement: String(form.get('statement') || ''), note: String(form.get('note') || ''), decision: String(form.get('decision') || 'PENDING'),
      kind: String(form.get('kind') || 'PREFERENCE'), sourceInteractionId: String(form.get('sourceInteractionId') || '') || null }); }
    catch (e: any) { return fail(400, { error: e?.message || 'Could not save proposed understanding.' }); }
    throw redirect(303, `/dating/people/${params.id}/understanding?reviewSaved=1#current-knowledge`);
  },
  review: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    try { await reviewDatingUnderstanding(scope, {
      proposalId: String(form.get('proposalId') || ''), statement: String(form.get('statement') || ''),
      decision: String(form.get('decision') || ''), note: String(form.get('note') || '')
    }); }
    catch (e: any) { return fail(400, { error: e?.message || 'Could not review this understanding.' }); }
    throw redirect(303, `/dating/people/${params.id}/understanding`);
  }
};
