// PURPOSE: Stage 8.12.0 - participant-specific Living Understanding pilot.
// SECURITY: Require the request's Dating ContextSpace and scope every operation by owner + context + contact.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { suggestDatingKnowledge } from '$lib/server/datingKnowledgeExtraction';
import { REALMS, possibleRealmHint, listUnderstandingTopics, createUnderstandingTopic, assignKnowledgeTopic, unassignKnowledgeTopic } from '$lib/server/datingUnderstandingTopics';
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
  const namedKnowledge = currentKnowledge.map(claim => {
    const hintKey = possibleRealmHint(claim.kind, claim.statement);
    return { ...claim, possibleRealm: hintKey ? REALMS.find(r => r.key === hintKey)?.name ?? null : null };
  });
  return { personId: scope.contactId, name: await contactDisplayName(contact),
    entries: await listDatingUnderstanding(scope), currentKnowledge: namedKnowledge,
    realms: REALMS, topicTree: await listUnderstandingTopics(scope), selectedSource }; 
};
export const actions: Actions = {
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
    throw redirect(303, `/dating/people/${params.id}/understanding#realms`);
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
        if (!quote || quote.length > 800 || !normalize(source.text).includes(normalize(quote))) throw new Error('Missing or invalid supporting passage.');
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
    throw redirect(303, `/dating/people/${params.id}/understanding`);
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
      console.error('[dating knowledge suggestions] failed', error?.name || 'unknown');
      return fail(400, { suggestionError: 'Suggestions could not be generated. You can still add knowledge manually.' });
    }
  },
  propose: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    try { await createDatingUnderstanding(scope, { statement: String(form.get('statement') || ''), note: String(form.get('note') || ''), decision: String(form.get('decision') || 'PENDING'),
      kind: String(form.get('kind') || 'PREFERENCE'), sourceInteractionId: String(form.get('sourceInteractionId') || '') || null }); }
    catch (e: any) { return fail(400, { error: e?.message || 'Could not save proposed understanding.' }); }
    throw redirect(303, `/dating/people/${params.id}/understanding`);
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
