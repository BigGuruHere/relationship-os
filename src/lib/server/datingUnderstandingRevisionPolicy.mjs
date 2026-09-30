// @ts-nocheck
// PURPOSE: Pure, deterministic guards for read-only Living Understanding revision experiments.
// SECURITY: Model output is untrusted. Report omissions and unsupported evidence, never mutate claims.
export const EXPERIMENT_ACTIONS = ['UNCHANGED', 'SUPPORTS', 'REFINES', 'POTENTIAL_CONFLICT', 'POTENTIAL_SUPERSESSION'];
export const EXPERIMENT_KINDS = ['FACT', 'WANT', 'OFFER', 'PREFERENCE', 'CONSTRAINT', 'OBJECTIVE', 'OTHER'];
export const EXPERIMENT_CERTAINTIES = ['DIRECT', 'REPORTED', 'INFERRED', 'UNCERTAIN'];
export const TOPIC_IMPACTS = ['SIGNIFICANT', 'POSSIBLE', 'SUPPORTING'];

// Stage 8.12.13.5 compatibility. This keeps the earlier exact-quote experiment testable.
export function validateRevisionDraft(raw, existing, source, evidenceMatch) {
  if (!raw || typeof raw !== 'object') throw new Error('The model did not provide a revision.');
  const summary = String(raw.revisedUnderstanding ?? '').trim();
  if (summary.length < 20 || summary.length > 6500) throw new Error('The revised understanding was missing or too long.');
  const oldIds = new Set(existing.map(item => item.id));
  const seen = new Set();
  const changes = [];
  const errors = [];
  if (Array.isArray(raw.existingKnowledge) && raw.existingKnowledge.length > 100) errors.push('The model returned more than 100 prior-claim actions; some cannot be reviewed.');
  if (Array.isArray(raw.newKnowledge) && raw.newKnowledge.length > 35) errors.push('The model returned more than 35 new suggestions; some cannot be reviewed.');
  const rows = Array.isArray(raw.existingKnowledge) ? raw.existingKnowledge.slice(0, 100) : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !oldIds.has(row.claimId) || seen.has(row.claimId)) {
      errors.push('An unknown or repeated prior claim reference was returned.');
      continue;
    }
    seen.add(row.claimId);
    if (!EXPERIMENT_ACTIONS.includes(row.action)) {
      errors.push(`Invalid action on prior claim ${row.claimId}.`);
      continue;
    }
    const candidate = { claimId: row.claimId, action: row.action,
      proposedStatement: String(row.proposedStatement ?? '').trim().slice(0, 600),
      reason: String(row.reason ?? '').trim().slice(0, 800),
      evidenceQuote: String(row.evidenceQuote ?? '').trim().slice(0, 800),
      evidenceValid: false, exactEvidence: '' };
    if (row.action !== 'UNCHANGED') {
      const recovered = evidenceMatch(source, candidate.evidenceQuote);
      candidate.evidenceValid = Boolean(recovered);
      candidate.exactEvidence = recovered ?? '';
      if (!recovered) errors.push(`Missing target-speaker evidence for prior claim ${row.claimId}.`);
    }
    changes.push(candidate);
  }
  const omittedClaimIds = [...oldIds].filter(id => !seen.has(id));
  if (omittedClaimIds.length) errors.push(`${omittedClaimIds.length} prior claims were omitted from the model's change record.`);
  const proposals = [];
  for (const row of (Array.isArray(raw.newKnowledge) ? raw.newKnowledge.slice(0, 35) : [])) {
    if (!row || typeof row !== 'object') continue;
    const kind = EXPERIMENT_KINDS.includes(row.kind) ? row.kind : 'OTHER';
    const certainty = EXPERIMENT_CERTAINTIES.includes(row.certainty) ? row.certainty : 'UNCERTAIN';
    const statement = String(row.statement ?? '').trim().slice(0, 600);
    const quote = String(row.evidenceQuote ?? '').trim().slice(0, 800);
    if (!statement || !quote) { errors.push('A new proposal lacked a statement or evidence.'); continue; }
    const recovered = evidenceMatch(source, quote);
    if (!recovered) errors.push('A new proposal contains evidence that does not match the selected speaker.');
    proposals.push({ kind, certainty, statement, evidenceQuote: quote, exactEvidence: recovered ?? '', evidenceValid: Boolean(recovered) });
  }
  return { summary, changes, proposals, omittedClaimIds, errors,
    // No unvalidated model content is eligible for automatic persistence or disclosure.
    validForReview: errors.length === 0 };
}

function normalizeTurnIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => String(item ?? '').trim()).filter(Boolean))].slice(0, 12);
}

function resolveEvidence(turnIds, targetTurns, allTurns) {
  const ids = normalizeTurnIds(turnIds);
  if (!ids.length) return { valid: false, ids, turns: [], reason: 'No source turn was supplied.' };
  const allById = new Map(allTurns.map(turn => [turn.id, turn]));
  const targetById = new Map(targetTurns.map(turn => [turn.id, turn]));
  const missing = ids.filter(id => !allById.has(id));
  if (missing.length) return { valid: false, ids, turns: [], reason: `Unknown source turn: ${missing.join(', ')}` };
  const wrongSpeaker = ids.filter(id => !targetById.has(id));
  if (wrongSpeaker.length) return { valid: false, ids, turns: ids.map(id => allById.get(id)).filter(Boolean), reason: `Evidence includes a non-target speaker turn: ${wrongSpeaker.join(', ')}` };
  return { valid: true, ids, turns: ids.map(id => targetById.get(id)).filter(Boolean), reason: '' };
}

// Stage 8.12.13.6: validate turn references instead of trusting AI-reproduced quotations.
export function validateTurnAnchoredRevisionDraft(raw, existing, targetTurns, allTurns) {
  if (!raw || typeof raw !== 'object') throw new Error('The model did not provide a revision.');
  const summary = String(raw.revisedUnderstanding ?? '').trim();
  if (summary.length < 20 || summary.length > 6500) throw new Error('The revised understanding was missing or too long.');
  const oldIds = new Set(existing.map(item => item.id));
  const seen = new Set();
  const changes = [];
  const errors = [];
  const rows = Array.isArray(raw.existingKnowledge) ? raw.existingKnowledge.slice(0, 100) : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !oldIds.has(row.claimId) || seen.has(row.claimId)) {
      errors.push('An unknown or repeated prior claim reference was returned.');
      continue;
    }
    seen.add(row.claimId);
    if (!EXPERIMENT_ACTIONS.includes(row.action)) {
      errors.push(`Invalid action on prior claim ${row.claimId}.`);
      continue;
    }
    const evidence = row.action === 'UNCHANGED'
      ? { valid: true, ids: [], turns: [], reason: '' }
      : resolveEvidence(row.evidenceTurnIds, targetTurns, allTurns);
    if (!evidence.valid) errors.push(`Invalid target-speaker evidence for prior claim ${row.claimId}: ${evidence.reason}`);
    changes.push({
      claimId: row.claimId,
      action: row.action,
      proposedStatement: String(row.proposedStatement ?? '').trim().slice(0, 600),
      reason: String(row.reason ?? '').trim().slice(0, 800),
      evidenceTurnIds: evidence.ids,
      evidenceTurns: evidence.turns,
      evidenceValid: evidence.valid
    });
  }
  const omittedClaimIds = [...oldIds].filter(id => !seen.has(id));
  if (omittedClaimIds.length) errors.push(`${omittedClaimIds.length} prior claims were omitted from the model's change record.`);

  const proposals = [];
  for (const row of (Array.isArray(raw.newKnowledge) ? raw.newKnowledge.slice(0, 35) : [])) {
    if (!row || typeof row !== 'object') continue;
    const kind = EXPERIMENT_KINDS.includes(row.kind) ? row.kind : 'OTHER';
    const certainty = EXPERIMENT_CERTAINTIES.includes(row.certainty) ? row.certainty : 'UNCERTAIN';
    const statement = String(row.statement ?? '').trim().slice(0, 600);
    if (!statement) { errors.push('A new proposal lacked a statement.'); continue; }
    const evidence = resolveEvidence(row.evidenceTurnIds, targetTurns, allTurns);
    if (!evidence.valid) errors.push(`A new proposal has invalid evidence: ${evidence.reason}`);
    proposals.push({ kind, certainty, statement, evidenceTurnIds: evidence.ids, evidenceTurns: evidence.turns, evidenceValid: evidence.valid });
  }
  return { summary, changes, proposals, omittedClaimIds, errors, validForReview: errors.length === 0 };
}

// Topic discovery is advisory only. Unknown topic IDs are rejected rather than silently mapped.
export function validateTopicImpactDraft(raw, authorisedTopics, targetTurns = [], allTurns = []) {
  if (!raw || typeof raw !== 'object') throw new Error('The model did not provide a topic analysis.');
  const byId = new Map(authorisedTopics.map(topic => [topic.id, topic]));
  const seen = new Set();
  const impacts = [];
  const errors = [];
  for (const row of (Array.isArray(raw.affectedTopics) ? raw.affectedTopics.slice(0, 20) : [])) {
    if (!row || typeof row !== 'object') continue;
    const id = String(row.topicId ?? '').trim();
    if (!byId.has(id)) { errors.push('The model referenced an unknown topic.'); continue; }
    if (seen.has(id)) { errors.push('The model repeated an affected topic.'); continue; }
    seen.add(id);
    const impact = TOPIC_IMPACTS.includes(row.impact) ? row.impact : 'POSSIBLE';
    const evidence = targetTurns.length && allTurns.length
      ? resolveEvidence(row.relevantTurnIds, targetTurns, allTurns)
      : { valid: true, ids: normalizeTurnIds(row.relevantTurnIds), turns: [], reason: '' };
    if (!evidence.valid) errors.push(`Invalid topic evidence for ${byId.get(id).label}: ${evidence.reason}`);
    impacts.push({ topicId: id, label: byId.get(id).label, impact,
      reason: String(row.reason ?? '').trim().slice(0, 800),
      relevantTurnIds: evidence.ids, relevantTurns: evidence.turns, evidenceValid: evidence.valid });
  }
  const newTopics = [];
  for (const row of (Array.isArray(raw.suggestedNewTopics) ? raw.suggestedNewTopics.slice(0, 8) : [])) {
    if (!row || typeof row !== 'object') continue;
    const realm = String(row.realm ?? '').trim().slice(0, 100);
    const name = String(row.name ?? '').trim().slice(0, 100);
    const reason = String(row.reason ?? '').trim().slice(0, 800);
    const evidence = targetTurns.length && allTurns.length
      ? resolveEvidence(row.relevantTurnIds, targetTurns, allTurns)
      : { valid: true, ids: normalizeTurnIds(row.relevantTurnIds), turns: [], reason: '' };
    if (!evidence.valid) errors.push(`Invalid suggested-topic evidence for ${realm || 'unknown realm'} / ${name || 'unknown topic'}: ${evidence.reason}`);
    if (realm && name) newTopics.push({ realm, name, reason, relevantTurnIds: evidence.ids, relevantTurns: evidence.turns, evidenceValid: evidence.valid });
  }
  return { impacts, newTopics, errors };
}

// Stage 8.12.13.7: semantic decomposition keeps rich topic understanding separate from
// the smaller set of knowledge units that need their own operational/permission boundary.
export const OPERATIONAL_REASONS = ['MATCHING', 'PERMISSION', 'DISCLOSURE', 'VERIFICATION', 'RETRIEVAL', 'ACTION'];

function normalizeOperationalReasons(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => String(item ?? '').trim()).filter(item => OPERATIONAL_REASONS.includes(item)))].slice(0, 6);
}

export function validateSemanticDecompositionDraft(raw, authorisedTopics, targetTurns = [], allTurns = []) {
  if (!raw || typeof raw !== 'object') throw new Error('The model did not provide a semantic decomposition.');
  const byId = new Map(authorisedTopics.map(topic => [topic.id, topic]));
  const areas = [];
  const errors = [];
  const rows = Array.isArray(raw.areas) ? raw.areas.slice(0, 12) : [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || typeof row !== 'object') continue;
    const requestedTopicId = String(row.existingTopicId ?? '').trim();
    const existingTopic = requestedTopicId ? byId.get(requestedTopicId) : null;
    const suggestedRealm = String(row.suggestedRealm ?? '').trim().slice(0, 100);
    const suggestedTopic = String(row.suggestedTopic ?? '').trim().slice(0, 100);

    if (requestedTopicId && !existingTopic) {
      errors.push('A semantic area referenced an unknown existing topic.');
      continue;
    }
    if (!existingTopic && (!suggestedRealm || !suggestedTopic)) {
      errors.push('A semantic area without an existing topic must contain a suggested realm and topic.');
      continue;
    }

    const evidence = targetTurns.length && allTurns.length
      ? resolveEvidence(row.relevantTurnIds, targetTurns, allTurns)
      : { valid: true, ids: normalizeTurnIds(row.relevantTurnIds), turns: [], reason: '' };
    if (!evidence.valid) errors.push(`Invalid semantic-area evidence: ${evidence.reason}`);

    const areaId = `A${String(areas.length + 1).padStart(2, '0')}`;
    const label = existingTopic ? existingTopic.label : `${suggestedRealm} / ${suggestedTopic}`;
    areas.push({
      areaId,
      sourceIndex: index + 1,
      existingTopicId: existingTopic?.id ?? '',
      label,
      realm: existingTopic?.realmName ?? suggestedRealm,
      topicName: existingTopic?.topicName ?? suggestedTopic,
      proposedNewTopic: !existingTopic,
      impact: TOPIC_IMPACTS.includes(row.impact) ? row.impact : 'POSSIBLE',
      reason: String(row.reason ?? '').trim().slice(0, 1000),
      relevantTurnIds: evidence.ids,
      relevantTurns: evidence.turns,
      evidenceValid: evidence.valid
    });
  }

  const sourceIndexToAreaId = new Map(areas.map(area => [area.sourceIndex, area.areaId]));
  const units = [];
  for (const row of (Array.isArray(raw.operationalKnowledge) ? raw.operationalKnowledge.slice(0, 30) : [])) {
    if (!row || typeof row !== 'object') continue;
    const statement = String(row.statement ?? '').trim().slice(0, 600);
    if (!statement) { errors.push('An operational knowledge proposal lacked a statement.'); continue; }
    const areaIndexes = Array.isArray(row.areaIndexes)
      ? [...new Set(row.areaIndexes.map(value => Number(value)).filter(value => Number.isInteger(value) && sourceIndexToAreaId.has(value)))].slice(0, 8)
      : [];
    if (!areaIndexes.length) { errors.push('An operational knowledge proposal was not linked to a valid semantic area.'); continue; }
    const operationalReasons = normalizeOperationalReasons(row.operationalReasons);
    if (!operationalReasons.length) { errors.push('An operational knowledge proposal had no valid operational reason.'); continue; }
    const evidence = targetTurns.length && allTurns.length
      ? resolveEvidence(row.evidenceTurnIds, targetTurns, allTurns)
      : { valid: true, ids: normalizeTurnIds(row.evidenceTurnIds), turns: [], reason: '' };
    if (!evidence.valid) errors.push(`Invalid operational knowledge evidence: ${evidence.reason}`);
    units.push({
      unitId: `K${String(units.length + 1).padStart(2, '0')}`,
      kind: EXPERIMENT_KINDS.includes(row.kind) ? row.kind : 'OTHER',
      certainty: EXPERIMENT_CERTAINTIES.includes(row.certainty) ? row.certainty : 'UNCERTAIN',
      statement,
      operationalReasons,
      areaIds: areaIndexes.map(value => sourceIndexToAreaId.get(value)).filter(Boolean),
      evidenceTurnIds: evidence.ids,
      evidenceTurns: evidence.turns,
      evidenceValid: evidence.valid
    });
  }

  return { areas, operationalUnits: units, errors, validForReview: errors.length === 0 };
}

// Stage 8.12.13.7.1: one topic target must produce one Living Understanding revision.
// Distinct semantic areas may still be shown separately, but selected areas that target the
// same existing topic (or the same proposed realm/topic) are consolidated before model revision.
export function consolidateSemanticAreasForRevision(selectedAreas) {
  const groups = [];
  const byKey = new Map();
  const impactRank = { SUPPORTING: 1, POSSIBLE: 2, SIGNIFICANT: 3 };

  for (const raw of Array.isArray(selectedAreas) ? selectedAreas : []) {
    if (!raw || typeof raw !== 'object') continue;
    const sourceAreaId = String(raw.areaId ?? '').trim();
    if (!sourceAreaId) continue;
    const existingTopicId = String(raw.existingTopicId ?? '').trim();
    const realm = String(raw.realm ?? '').trim().slice(0, 100);
    const topicName = String(raw.topicName ?? '').trim().slice(0, 100);
    if (!existingTopicId && (!realm || !topicName)) continue;

    const key = existingTopicId
      ? `existing:${existingTopicId}`
      : `suggested:${realm.toLocaleLowerCase()}::${topicName.toLocaleLowerCase()}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        areaId: `R${String(groups.length + 1).padStart(2, '0')}`,
        targetKey: key,
        sourceAreaIds: [],
        existingTopicId,
        realm,
        topicName,
        relevantTurnIds: [],
        impact: TOPIC_IMPACTS.includes(raw.impact) ? raw.impact : 'POSSIBLE',
        reasons: []
      };
      groups.push(group);
      byKey.set(key, group);
    }

    group.sourceAreaIds.push(sourceAreaId);
    group.relevantTurnIds = [...new Set([
      ...group.relevantTurnIds,
      ...(Array.isArray(raw.relevantTurnIds) ? raw.relevantTurnIds.map(value => String(value ?? '').trim()).filter(Boolean) : [])
    ])].slice(0, 30);
    const nextImpact = TOPIC_IMPACTS.includes(raw.impact) ? raw.impact : 'POSSIBLE';
    if ((impactRank[nextImpact] ?? 0) > (impactRank[group.impact] ?? 0)) group.impact = nextImpact;
    const reason = String(raw.reason ?? '').trim().slice(0, 1000);
    if (reason && !group.reasons.includes(reason)) group.reasons.push(reason);
  }
  return groups;
}


// Stage 8.12.13.7.3: retain a small model-call batch size without turning it into a UI limit.
// The experiment can therefore revise more than eight selected semantic areas safely, while
// keeping each batch bounded and preserving one consolidated revision per topic target.
export function batchRevisionTargets(targets, batchSize = 8) {
  const safeSize = Number.isInteger(batchSize) && batchSize > 0 ? Math.min(batchSize, 12) : 8;
  const clean = Array.isArray(targets) ? targets.filter(Boolean) : [];
  const batches = [];
  for (let index = 0; index < clean.length; index += safeSize) {
    batches.push(clean.slice(index, index + safeSize));
  }
  return batches;
}

export function validateOperationalUnitsFromForm(rawUnits, selectedAreas, targetTurns = [], allTurns = []) {
  const selectedIds = new Set(selectedAreas.map(area => area.areaId));
  const units = [];
  const errors = [];
  for (const row of (Array.isArray(rawUnits) ? rawUnits.slice(0, 30) : [])) {
    if (!row || typeof row !== 'object') continue;
    const statement = String(row.statement ?? '').trim().slice(0, 600);
    if (!statement) continue;
    const areaIds = Array.isArray(row.areaIds)
      ? [...new Set(row.areaIds.map(value => String(value ?? '').trim()).filter(value => selectedIds.has(value)))].slice(0, 8)
      : [];
    if (!areaIds.length) continue;
    const operationalReasons = normalizeOperationalReasons(row.operationalReasons);
    if (!operationalReasons.length) continue;
    const evidence = resolveEvidence(row.evidenceTurnIds, targetTurns, allTurns);
    if (!evidence.valid) errors.push(`Invalid operational knowledge evidence: ${evidence.reason}`);
    units.push({
      unitId: String(row.unitId ?? '').trim().slice(0, 20) || `K${String(units.length + 1).padStart(2, '0')}`,
      kind: EXPERIMENT_KINDS.includes(row.kind) ? row.kind : 'OTHER',
      certainty: EXPERIMENT_CERTAINTIES.includes(row.certainty) ? row.certainty : 'UNCERTAIN',
      statement,
      operationalReasons,
      areaIds,
      evidenceTurnIds: evidence.ids,
      evidenceTurns: evidence.turns,
      evidenceValid: evidence.valid
    });
  }
  return { units, errors };
}


// Stage 8.12.13.8: longitudinal experiment classifications. Every previous topic target must
// be explicitly accounted for so a later source can never silently erase earlier understanding.
export const LONGITUDINAL_EFFECTS = ['UNCHANGED', 'REINFORCED', 'REFINED', 'EXPANDED', 'QUALIFIED', 'CONTRADICTED', 'SUPERSEDED'];
export const LONGITUDINAL_OPERATIONAL_ACTIONS = ['UNCHANGED', 'REINFORCED', 'REFINED', 'POTENTIAL_CONFLICT', 'POTENTIAL_RETIREMENT'];

export function validateLongitudinalSeed(rawSeed) {
  const rows = Array.isArray(rawSeed) ? rawSeed.slice(0, 24) : [];
  const seeds = [];
  const seen = new Set();
  const errors = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const targetKey = String(row.targetKey ?? '').trim().slice(0, 220);
    const topicName = String(row.topicName ?? '').trim().slice(0, 220);
    const proposedUnderstanding = String(row.proposedUnderstanding ?? '').trim().slice(0, 6500);
    const sourceInteractionId = String(row.sourceInteractionId ?? '').trim().slice(0, 120);
    const sourceDate = String(row.sourceDate ?? '').trim().slice(0, 80);
    if (!targetKey || !topicName || proposedUnderstanding.length < 20 || !sourceInteractionId) {
      errors.push('A longitudinal seed row was incomplete.');
      continue;
    }
    if (seen.has(targetKey)) {
      errors.push('A longitudinal seed repeated a topic target.');
      continue;
    }
    seen.add(targetKey);
    seeds.push({
      targetKey,
      topicId: String(row.topicId ?? '').trim().slice(0, 120),
      topicName,
      proposedNewTopic: Boolean(row.proposedNewTopic),
      proposedUnderstanding,
      sourceInteractionId,
      sourceDate,
      sourceInteractionIds: Array.isArray(row.sourceInteractionIds) ? [...new Set(row.sourceInteractionIds.map(value => String(value ?? '').trim().slice(0, 120)).filter(Boolean))].slice(-12) : [sourceInteractionId],
      semanticBoundary: Array.isArray(row.semanticBoundary) ? row.semanticBoundary.map(value => String(value ?? '').trim().slice(0, 1200)).filter(Boolean).slice(0, 8) : [],
      excludedTopicHints: Array.isArray(row.excludedTopicHints) ? row.excludedTopicHints.map(value => String(value ?? '').trim().slice(0, 1200)).filter(Boolean).slice(0, 16) : []
    });
  }
  if (!seeds.length) errors.push('No valid prior Living Understanding was supplied for longitudinal comparison.');
  return { seeds, errors, validForReview: seeds.length > 0 && errors.length === 0 };
}

export function validateLongitudinalAnalysisDraft(raw, priorSeeds, targetTurns = [], allTurns = []) {
  if (!raw || typeof raw !== 'object') throw new Error('The model did not provide a longitudinal analysis.');
  const seedByKey = new Map(priorSeeds.map(seed => [seed.targetKey, seed]));
  const seen = new Set();
  const topicEffects = [];
  const newTopics = [];
  const errors = [];

  for (const row of (Array.isArray(raw.topicEffects) ? raw.topicEffects.slice(0, 40) : [])) {
    if (!row || typeof row !== 'object') continue;
    const targetKey = String(row.targetKey ?? '').trim();
    if (!seedByKey.has(targetKey) || seen.has(targetKey)) {
      errors.push('The longitudinal analysis returned an unknown or repeated topic target.');
      continue;
    }
    seen.add(targetKey);
    const effect = LONGITUDINAL_EFFECTS.includes(row.effect) ? row.effect : 'UNCHANGED';
    const evidence = effect === 'UNCHANGED'
      ? { valid: true, ids: [], turns: [], reason: '' }
      : resolveEvidence(row.relevantTurnIds, targetTurns, allTurns);
    if (!evidence.valid) errors.push(`Invalid longitudinal evidence for ${seedByKey.get(targetKey).topicName}: ${evidence.reason}`);
    topicEffects.push({
      targetKey,
      topicName: seedByKey.get(targetKey).topicName,
      effect,
      reason: String(row.reason ?? '').trim().slice(0, 1200),
      relevantTurnIds: evidence.ids,
      relevantTurns: evidence.turns,
      evidenceValid: evidence.valid
    });
  }

  const omitted = priorSeeds.filter(seed => !seen.has(seed.targetKey)).map(seed => seed.targetKey);
  if (omitted.length) errors.push(`${omitted.length} prior topic understandings were omitted from the longitudinal change record.`);

  for (const row of (Array.isArray(raw.newTopics) ? raw.newTopics.slice(0, 12) : [])) {
    if (!row || typeof row !== 'object') continue;
    const realm = String(row.realm ?? '').trim().slice(0, 100);
    const topicName = String(row.topicName ?? '').trim().slice(0, 100);
    if (!realm || !topicName) continue;
    const targetKey = `suggested:${realm.toLocaleLowerCase()}::${topicName.toLocaleLowerCase()}`;
    if (seedByKey.has(targetKey)) {
      errors.push(`A proposed new longitudinal topic duplicates an existing prior topic target: ${realm} / ${topicName}.`);
      continue;
    }
    const evidence = resolveEvidence(row.relevantTurnIds, targetTurns, allTurns);
    if (!evidence.valid) errors.push(`Invalid longitudinal evidence for new topic ${realm} / ${topicName}: ${evidence.reason}`);
    newTopics.push({
      targetKey,
      topicName: `${realm} / ${topicName}`,
      realm,
      name: topicName,
      reason: String(row.reason ?? '').trim().slice(0, 1200),
      relevantTurnIds: evidence.ids,
      relevantTurns: evidence.turns,
      evidenceValid: evidence.valid
    });
  }
  return { topicEffects, newTopics, omittedTargetKeys: omitted, errors, validForReview: errors.length === 0 };
}

export function validateLongitudinalOperationalDraft(raw, priorUnits, targetTurns = [], allTurns = []) {
  const previous = Array.isArray(priorUnits) ? priorUnits.slice(0, 40) : [];
  const byId = new Map(previous.map(unit => [unit.unitId, unit]));
  const seen = new Set();
  const changes = [];
  const additions = [];
  const errors = [];

  for (const row of (Array.isArray(raw?.existingOperationalKnowledge) ? raw.existingOperationalKnowledge.slice(0, 60) : [])) {
    if (!row || typeof row !== 'object') continue;
    const unitId = String(row.unitId ?? '').trim();
    if (!byId.has(unitId) || seen.has(unitId)) {
      errors.push('The longitudinal operational analysis returned an unknown or repeated prior unit.');
      continue;
    }
    seen.add(unitId);
    const action = LONGITUDINAL_OPERATIONAL_ACTIONS.includes(row.action) ? row.action : 'UNCHANGED';
    const evidence = action === 'UNCHANGED'
      ? { valid: true, ids: [], turns: [], reason: '' }
      : resolveEvidence(row.evidenceTurnIds, targetTurns, allTurns);
    if (!evidence.valid) errors.push(`Invalid operational evidence for ${unitId}: ${evidence.reason}`);
    changes.push({
      unitId,
      action,
      proposedStatement: String(row.proposedStatement ?? '').trim().slice(0, 600),
      reason: String(row.reason ?? '').trim().slice(0, 1000),
      evidenceTurnIds: evidence.ids,
      evidenceTurns: evidence.turns,
      evidenceValid: evidence.valid
    });
  }
  const omittedUnitIds = previous.filter(unit => !seen.has(unit.unitId)).map(unit => unit.unitId);
  if (omittedUnitIds.length) errors.push(`${omittedUnitIds.length} prior operational units were omitted from the longitudinal change record.`);

  for (const row of (Array.isArray(raw?.newOperationalKnowledge) ? raw.newOperationalKnowledge.slice(0, 30) : [])) {
    if (!row || typeof row !== 'object') continue;
    const statement = String(row.statement ?? '').trim().slice(0, 600);
    if (!statement) continue;
    const operationalReasons = normalizeOperationalReasons(row.operationalReasons);
    if (!operationalReasons.length) { errors.push('A new longitudinal operational unit had no valid operational reason.'); continue; }
    const evidence = resolveEvidence(row.evidenceTurnIds, targetTurns, allTurns);
    if (!evidence.valid) errors.push(`Invalid evidence for new longitudinal operational knowledge: ${evidence.reason}`);
    additions.push({
      unitId: `N${String(additions.length + 1).padStart(2, '0')}`,
      kind: EXPERIMENT_KINDS.includes(row.kind) ? row.kind : 'OTHER',
      certainty: EXPERIMENT_CERTAINTIES.includes(row.certainty) ? row.certainty : 'UNCERTAIN',
      statement,
      operationalReasons,
      evidenceTurnIds: evidence.ids,
      evidenceTurns: evidence.turns,
      evidenceValid: evidence.valid
    });
  }

  const interactionState = [];
  for (const row of (Array.isArray(raw?.newInteractionState) ? raw.newInteractionState.slice(0, 20) : [])) {
    if (!row || typeof row !== 'object') continue;
    const statement = String(row.statement ?? '').trim().slice(0, 600);
    if (!statement) continue;
    const evidence = resolveEvidence(row.evidenceTurnIds, targetTurns, allTurns);
    if (!evidence.valid) errors.push(`Invalid evidence for temporary interaction state: ${evidence.reason}`);
    interactionState.push({
      stateId: `S${String(interactionState.length + 1).padStart(2, '0')}`,
      statement,
      evidenceTurnIds: evidence.ids,
      evidenceTurns: evidence.turns,
      evidenceValid: evidence.valid
    });
  }
  return { changes, additions, interactionState, omittedUnitIds, errors, validForReview: errors.length === 0 };
}


// Stage 8.12.13.8.3: validate a read-only restructuring proposal. This is structural only:
// every prior topic must remain represented in at least one proposed topic so restructuring
// cannot silently erase current understanding. One prior topic may map to several proposed
// topics (split), and several prior topics may map to one proposed topic (merge/reclassification).
export function validateTopicRestructureDraft(raw, priorSeeds) {
  if (!raw || typeof raw !== 'object') throw new Error('The model did not provide a topic restructuring proposal.');
  const previous = Array.isArray(priorSeeds) ? priorSeeds.slice(0, 24) : [];
  const byKey = new Map(previous.map(seed => [seed.targetKey, seed]));
  const coverage = new Map(previous.map(seed => [seed.targetKey, 0]));
  const proposedTopics = [];
  const errors = [];
  const seenTargetKeys = new Set();

  // Stage 8.12.13.8.3.1: require an explicit contamination audit for every prior topic before
  // accepting KEEP. This does not try to semantically judge the model with heuristics. Instead,
  // it makes the model expose its own structural tests and rejects internally inconsistent KEEP decisions.
  const allowedFlags = new Set(['NONE', 'MULTIPLE_INDEPENDENT_CONCEPTS', 'BELONGS_ELSEWHERE', 'TOPIC_NAME_MISMATCH', 'DUPLICATES_OTHER_TOPIC']);
  const audits = [];
  const auditByKey = new Map();
  for (const row of (Array.isArray(raw.topicAudits) ? raw.topicAudits.slice(0, 30) : [])) {
    if (!row || typeof row !== 'object') continue;
    const targetKey = String(row.targetKey ?? '').trim().slice(0, 220);
    if (!byKey.has(targetKey) || auditByKey.has(targetKey)) continue;
    const semanticConcepts = Array.isArray(row.semanticConcepts)
      ? [...new Set(row.semanticConcepts.map(value => String(value ?? '').trim()).filter(Boolean))].slice(0, 12)
      : [];
    const rawFlags = Array.isArray(row.contaminationFlags)
      ? [...new Set(row.contaminationFlags.map(value => String(value ?? '').trim()).filter(value => allowedFlags.has(value)))].slice(0, 5)
      : [];
    const contaminationFlags = rawFlags.length ? rawFlags : ['NONE'];
    const overlappingTargetKeys = Array.isArray(row.overlappingTargetKeys)
      ? [...new Set(row.overlappingTargetKeys.map(value => String(value ?? '').trim()).filter(value => value !== targetKey && byKey.has(value)))].slice(0, 12)
      : [];
    const recommendedOperation = ['KEEP', 'NARROW', 'SPLIT', 'MERGE', 'MOVE', 'RENAME', 'RECLASSIFY'].includes(String(row.recommendedOperation))
      ? String(row.recommendedOperation)
      : 'RECLASSIFY';
    const keepCoherent = row.keepCoherent === true;
    const audit = {
      targetKey,
      topicName: byKey.get(targetKey)?.topicName ?? targetKey,
      semanticConcepts,
      contaminationFlags,
      overlappingTargetKeys,
      recommendedOperation,
      keepCoherent,
      explanation: String(row.explanation ?? '').trim().slice(0, 1600)
    };
    audits.push(audit);
    auditByKey.set(targetKey, audit);
  }
  for (const seed of previous) {
    if (!auditByKey.has(seed.targetKey)) errors.push(`Missing structural contamination audit for ${seed.topicName}.`);
  }

  for (const row of (Array.isArray(raw.proposedTopics) ? raw.proposedTopics.slice(0, 36) : [])) {
    if (!row || typeof row !== 'object') continue;
    const realm = String(row.realm ?? '').trim().slice(0, 100);
    const topicName = String(row.topicName ?? '').trim().slice(0, 120);
    const proposedUnderstanding = String(row.proposedUnderstanding ?? '').trim().slice(0, 6500);
    const sourceTargetKeys = Array.isArray(row.sourceTargetKeys)
      ? [...new Set(row.sourceTargetKeys.map(value => String(value ?? '').trim()).filter(value => byKey.has(value)))].slice(0, 12)
      : [];
    if (!realm || !topicName || proposedUnderstanding.length < 20 || !sourceTargetKeys.length) {
      errors.push('A proposed restructured topic was incomplete or did not reference a known prior topic.');
      continue;
    }
    for (const key of sourceTargetKeys) coverage.set(key, (coverage.get(key) ?? 0) + 1);
    let targetKey = String(row.targetKey ?? '').trim().slice(0, 220);
    if (!targetKey) targetKey = `restructured:${realm.toLocaleLowerCase()}::${topicName.toLocaleLowerCase()}`;
    if (seenTargetKeys.has(targetKey)) {
      errors.push(`The restructuring proposal repeated target ${realm} / ${topicName}.`);
      continue;
    }
    seenTargetKeys.add(targetKey);
    const operation = ['KEEP', 'NARROW', 'SPLIT', 'MERGE', 'MOVE', 'RENAME', 'RECLASSIFY'].includes(String(row.operation)) ? String(row.operation) : 'RECLASSIFY';
    if (operation === 'KEEP' && sourceTargetKeys.length === 1) {
      const audit = auditByKey.get(sourceTargetKeys[0]);
      if (!audit) {
        errors.push(`KEEP for ${realm} / ${topicName} has no structural contamination audit.`);
      } else {
        const positiveFlags = audit.contaminationFlags.filter(flag => flag !== 'NONE');
        if (!audit.keepCoherent || positiveFlags.length || audit.overlappingTargetKeys.length || audit.recommendedOperation !== 'KEEP') {
          errors.push(`KEEP for ${realm} / ${topicName} conflicts with its structural contamination audit.`);
        }
      }
    }
    proposedTopics.push({
      targetKey,
      realm,
      topicName,
      label: `${realm} / ${topicName}`,
      proposedUnderstanding,
      sourceTargetKeys,
      reason: String(row.reason ?? '').trim().slice(0, 1600),
      operation
    });
  }

  const omittedTargetKeys = previous.filter(seed => !(coverage.get(seed.targetKey) > 0)).map(seed => seed.targetKey);
  if (omittedTargetKeys.length) errors.push(`${omittedTargetKeys.length} prior topic understandings were omitted from the restructuring proposal.`);
  if (!proposedTopics.length) errors.push('No valid restructured topic was proposed.');

  return {
    audits,
    proposedTopics,
    coverage: previous.map(seed => ({
      targetKey: seed.targetKey,
      topicName: seed.topicName,
      proposedTopicCount: coverage.get(seed.targetKey) ?? 0
    })),
    omittedTargetKeys,
    errors,
    validForReview: proposedTopics.length > 0 && omittedTargetKeys.length === 0 && errors.length === 0
  };
}
