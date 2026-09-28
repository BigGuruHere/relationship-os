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
export function validateTopicImpactDraft(raw, authorisedTopics) {
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
    impacts.push({ topicId: id, label: byId.get(id).label, impact,
      reason: String(row.reason ?? '').trim().slice(0, 800) });
  }
  const newTopics = [];
  for (const row of (Array.isArray(raw.suggestedNewTopics) ? raw.suggestedNewTopics.slice(0, 8) : [])) {
    if (!row || typeof row !== 'object') continue;
    const realm = String(row.realm ?? '').trim().slice(0, 100);
    const name = String(row.name ?? '').trim().slice(0, 100);
    const reason = String(row.reason ?? '').trim().slice(0, 800);
    if (realm && name) newTopics.push({ realm, name, reason });
  }
  return { impacts, newTopics, errors };
}
