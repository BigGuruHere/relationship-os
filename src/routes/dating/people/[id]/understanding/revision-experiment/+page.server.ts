// PURPOSE: Operator-only semantic decomposition and Living Understanding trial.
// SECURITY: No AI-generated understanding, topic, statement, permission or relationship data is persisted here.
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSourceReflection } from '$lib/server/datingLivingUnderstanding';
import { listUnderstandingTopics } from '$lib/server/datingUnderstandingTopics';
import {
  identifySemanticAreasReadOnly,
  revisionExperimentEnabled,
  reviseSemanticAreaReadOnly
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
  if (err instanceof Error && /exceeds the experiment limit|too many|too large|disabled|OPENAI_API_KEY|Choose an authorised topic|not accessible|inventory|semantic area/.test(err.message)) {
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
    if (areaIds.length > 8) return fail(400, { revisionError: 'Revise at most eight semantic areas in one experiment run.' });

    const rawOperationalUnits = parseJsonArray(form.get('operationalUnitsJson'));
    try {
      const revisions = [];
      for (const areaId of areaIds) {
        const existingTopicId = String(form.get(`existingTopicId:${areaId}`) || '');
        const realm = String(form.get(`realm:${areaId}`) || '');
        const topicName = String(form.get(`topicName:${areaId}`) || '');
        const relevantTurnIds = form.getAll(`relevantTurnId:${areaId}`).map(value => String(value)).filter(Boolean);
        const unitsForArea = rawOperationalUnits.filter((unit: any) => Array.isArray(unit?.areaIds) && unit.areaIds.includes(areaId));
        revisions.push(await reviseSemanticAreaReadOnly(scope, sourceId, {
          areaId,
          existingTopicId,
          realm,
          topicName,
          relevantTurnIds
        }, unitsForArea));
      }

      const operationalUnits: any[] = [];
      const seenUnits = new Set<string>();
      const operationalErrors: string[] = [];
      for (const revision of revisions) {
        operationalErrors.push(...revision.operationalErrors);
        for (const unit of revision.operationalUnits) {
          const key = `${unit.unitId}:${unit.statement}`;
          if (seenUnits.has(key)) {
            const existing = operationalUnits.find((item: any) => `${item.unitId}:${item.statement}` === key);
            if (existing) existing.areaIds = [...new Set([...existing.areaIds, ...unit.areaIds])];
            continue;
          }
          seenUnits.add(key);
          operationalUnits.push({ ...unit });
        }
      }
      return { revisions, operationalUnits, operationalErrors };
    } catch (err) {
      return fail(502, { revisionError: safeExperimentError(err) });
    }
  }
};
