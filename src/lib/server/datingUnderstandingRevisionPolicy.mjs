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
