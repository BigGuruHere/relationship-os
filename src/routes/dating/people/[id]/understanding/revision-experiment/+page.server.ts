// PURPOSE: Operator-only semantic decomposition and Living Understanding trial.
// SECURITY: No AI-generated understanding, topic, statement, permission or relationship data is persisted here.
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSourceReflection } from '$lib/server/datingLivingUnderstanding';
import { listUnderstandingTopics } from '$lib/server/datingUnderstandingTopics';
import { loadPersonHistory } from '$lib/server/datingPersonHistory';
import { batchRevisionTargets, consolidateSemanticAreasForRevision, validateOperationalUnitsFromForm, validateLongitudinalSeed } from '$lib/server/datingUnderstandingRevisionPolicy.mjs';
import {
  identifySemanticAreasReadOnly,
  revisionExperimentEnabled,
  reviseSemanticAreaReadOnly,
  evolveLongitudinalUnderstandingReadOnly
} from '$lib/server/datingUnderstandingRevisionExperiment';

function authorisedScope(locals: App.Locals, id: string) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) throw error(403, 'Select a Dating ContextSpace.');
  if (!revisionExperimentEnabled()) throw error(404, 'Experiment is not enabled.');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId, contactId: id };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const scope = authorisedScope(locals, params.id);
  const sourceId = String(url.searchParams.get('sourceInteractionId') || '');
  const [tree, source, history] = await Promise.all([
    listUnderstandingTopics(scope),
    sourceId ? requireSourceReflection(scope, sourceId) : Promise.resolve(null),
    loadPersonHistory(scope)
  ]);
  // IT: Longitudinal follow-up remains source-custody local. Only later private reflections or
  // conversation excerpts for this same person are offered as the second source. Text is not
  // returned in this selector because the action re-authorises and decrypts the chosen source.
  const laterSources = source
    ? history.reflections
        .filter(item => item.id !== source.id && item.at.getTime() > source.at.getTime())
        .map(item => ({ id: item.id, at: item.at.toISOString(), sourceKind: item.sourceKind, speaker: item.speaker }))
    : [];
  return {
    personId: params.id,
    sourceId: source?.id ?? '',
    sourceKind: source?.sourceKind ?? null,
    laterSources,
    topics: tree.flatMap(realm => realm.topics.map(topic => ({ id: topic.id, label: `${realm.name} / ${topic.name}`, count: topic.claims.length })))
  };
};

function safeExperimentError(err: unknown) {
  if (err instanceof Error && /exceeds the experiment limit|too many|too large|disabled|OPENAI_API_KEY|Choose an authorised topic|not accessible|inventory|semantic area|longitudinal|later source|prior Living/.test(err.message)) {
    return err.message;
  }
  return 'The experimental revision was unavailable or malformed. No stored knowledge was changed.';
}

function parseJsonArray(value: unknown) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const actions: Actions = {
  analyseTopics: async ({ locals, params, request }) => {
    const scope = authorisedScope(locals, params.id);
    const form = await request.formData();
    if (form.get('consent') !== 'YES') {
      return fail(400, { revisionError: 'Explicitly authorise sending the selected transcript and current topic inventory to the AI provider.' });
    }
    const sourceId = String(form.get('sourceInteractionId') || '');
    try {
      const semanticAnalysis = await identifySemanticAreasReadOnly(scope, sourceId);
      return { semanticAnalysis };
    } catch (err) {
      return fail(502, { revisionError: safeExperimentError(err) });
    }
  },

  reviseTopics: async ({ locals, params, request }) => {
    const scope = authorisedScope(locals, params.id);
    const form = await request.formData();
    if (form.get('consent') !== 'YES') {
      return fail(400, { revisionError: 'Explicitly authorise sending the selected source and semantic areas to the AI provider.' });
    }
    const sourceId = String(form.get('sourceInteractionId') || '');
    const areaIds = [...new Set(form.getAll('areaId').map(value => String(value)).filter(Boolean))];
    if (!areaIds.length) return fail(400, { revisionError: 'Choose at least one semantic area to revise.' });
    // IT: Eight is now a processing batch size, not a user-facing semantic limit. Keep a generous
    // hard ceiling only to protect this development-only experiment from malformed form payloads.
    if (areaIds.length > 32) return fail(400, { revisionError: 'This development experiment can revise at most 32 selected semantic areas in one request.' });

    const rawOperationalUnits = parseJsonArray(form.get('operationalUnitsJson'));
    try {
      // IT: Never ask the model for two revisions of the same topic. Semantic areas remain
      // distinct in the decomposition UI, but duplicate topic targets are consolidated here.
      const selectedAreas = areaIds.map(areaId => ({
        areaId,
        existingTopicId: String(form.get(`existingTopicId:${areaId}`) || ''),
        realm: String(form.get(`realm:${areaId}`) || ''),
        topicName: String(form.get(`topicName:${areaId}`) || ''),
        impact: String(form.get(`impact:${areaId}`) || ''),
        reason: String(form.get(`reason:${areaId}`) || ''),
        relevantTurnIds: form.getAll(`relevantTurnId:${areaId}`).map(value => String(value)).filter(Boolean)
      }));
      const revisionTargets = consolidateSemanticAreasForRevision(selectedAreas);
      if (!revisionTargets.length) return fail(400, { revisionError: 'No valid semantic area remained after consolidation.' });

      // IT: Topic revisions receive only their own validated evidence turns. We also provide the
      // model with sibling-area descriptions as exclusion boundaries, never as evidence. This keeps
      // a long source turn from pulling partner traits into family intentions, or vice versa.
      const revisions = [];
      const revisionBatches = batchRevisionTargets(revisionTargets, 8);
      for (let batchIndex = 0; batchIndex < revisionBatches.length; batchIndex += 1) {
        const batch = revisionBatches[batchIndex];
        // IT: Batches are processed sequentially so one large decomposition does not create an
        // unbounded burst of sensitive external model calls. Each topic target is still revised once.
        for (const target of batch) {
          const ownSourceIds = new Set(target.sourceAreaIds ?? []);
          const excludedAreaSummaries = selectedAreas
            .filter(area => !ownSourceIds.has(area.areaId))
            .map(area => `${area.realm} / ${area.topicName}: ${area.reason}`)
            .filter(value => value.trim().length > 3);
          revisions.push(await reviseSemanticAreaReadOnly(scope, sourceId, {
            ...target,
            excludedAreaSummaries
          }));
        }
      }

      // IT: Operational units retain their original semantic-area links. Revalidate the hidden
      // form payload once against all selected areas and the authorised source before display.
      const source = await requireSourceReflection(scope, sourceId);
      const { parseDatingTranscript } = await import('$lib/server/datingTranscriptImportPolicy');
      const turns = source.conversationContext && source.speaker
        ? parseDatingTranscript(source.conversationContext).turns.map((turn, index) => ({
            id: `T${String(index + 1).padStart(3, '0')}`,
            speaker: turn.speaker,
            text: turn.text,
            target: turn.speaker === source.speaker
          }))
        : [{ id: 'T001', speaker: 'reflection author', text: source.text, target: true }];
      const operational = validateOperationalUnitsFromForm(
        rawOperationalUnits,
        selectedAreas.map(area => ({ areaId: area.areaId })),
        turns.filter(turn => turn.target),
        turns
      );
      // IT: This snapshot is returned to the browser only. It is not persisted. The stable target
      // keys and source provenance prepare the next experiment to carry an understanding forward
      // across a second and third conversation without confusing topic identity.
      const longitudinalSeed = revisions.map(revision => ({
        targetKey: revision.targetKey,
        topicId: revision.topicId,
        topicName: revision.topicName,
        proposedNewTopic: revision.proposedNewTopic,
        proposedUnderstanding: revision.draft.summary,
        sourceInteractionId: revision.sourceInteractionId,
        sourceDate: revision.sourceDate
      }));
      return {
        revisions,
        operationalUnits: operational.units,
        operationalErrors: operational.errors,
        revisionBatchSummary: { selectedAreaCount: selectedAreas.length, targetCount: revisionTargets.length, batchCount: revisionBatches.length, batchSize: 8 },
        longitudinalSeed
      };
    } catch (err) {
      return fail(502, { revisionError: safeExperimentError(err) });
    }
  }
,

  compareLongitudinal: async ({ locals, params, request }) => {
    const scope = authorisedScope(locals, params.id);
    const form = await request.formData();
    if (form.get('consent') !== 'YES') {
      return fail(400, { revisionError: 'Explicitly authorise sending the later private source and prior experimental understanding to the AI provider.' });
    }
    const baselineSourceId = String(form.get('baselineSourceInteractionId') || '');
    const nextSourceId = String(form.get('nextSourceInteractionId') || '');
    if (!baselineSourceId || !nextSourceId || baselineSourceId === nextSourceId) {
      return fail(400, { revisionError: 'Choose a different later private source for longitudinal comparison.' });
    }
    const rawSeed = parseJsonArray(form.get('longitudinalSeedJson'));
    const seedValidation = validateLongitudinalSeed(rawSeed);
    if (!seedValidation.validForReview) {
      return fail(400, { revisionError: seedValidation.errors[0] || 'The prior experimental understanding was invalid.' });
    }
    if (seedValidation.seeds.some(seed => seed.sourceInteractionId !== baselineSourceId)) {
      return fail(400, { revisionError: 'The longitudinal baseline does not match the source that produced the prior understanding.' });
    }

    try {
      // IT: Re-authorise both sources against this same person/context before using any browser-carried
      // experimental state. This prevents a hidden-form payload from crossing custody boundaries.
      const [baselineSource, nextSource] = await Promise.all([
        requireSourceReflection(scope, baselineSourceId),
        requireSourceReflection(scope, nextSourceId)
      ]);
      if (nextSource.at.getTime() <= baselineSource.at.getTime()) {
        return fail(400, { revisionError: 'Choose a source later than the baseline source for this longitudinal experiment.' });
      }

      const rawPriorOperational = parseJsonArray(form.get('priorOperationalUnitsJson'));
      // The prior units are experimental, not authoritative. Sanitise their addressable fields before
      // sending them back to the model; the later source will independently validate any claimed change.
      const priorOperationalUnits = rawPriorOperational.slice(0, 40).map((row: any, index: number) => ({
        unitId: String(row?.unitId || `K${String(index + 1).padStart(2, '0')}`).slice(0, 20),
        kind: String(row?.kind || 'OTHER').slice(0, 30),
        certainty: String(row?.certainty || 'UNCERTAIN').slice(0, 30),
        statement: String(row?.statement || '').trim().slice(0, 600),
        operationalReasons: Array.isArray(row?.operationalReasons) ? row.operationalReasons.map((value: unknown) => String(value)).slice(0, 6) : []
      })).filter((row: any) => row.statement);

      const longitudinal = await evolveLongitudinalUnderstandingReadOnly(
        scope,
        nextSourceId,
        seedValidation.seeds,
        priorOperationalUnits
      );
      return { longitudinal };
    } catch (err) {
      return fail(502, { revisionError: safeExperimentError(err) });
    }
  }
};
