// @ts-nocheck
// PURPOSE: Pure, deterministic guards for the read-only Living Understanding revision experiment.
// SECURITY: Model output is untrusted. Report omissions and unsupported evidence, never mutate claims.
export const EXPERIMENT_ACTIONS = ['UNCHANGED', 'SUPPORTS', 'REFINES', 'POTENTIAL_CONFLICT', 'POTENTIAL_SUPERSESSION'];
export const EXPERIMENT_KINDS = ['FACT', 'WANT', 'OFFER', 'PREFERENCE', 'CONSTRAINT', 'OBJECTIVE', 'OTHER'];
export const EXPERIMENT_CERTAINTIES = ['DIRECT', 'REPORTED', 'INFERRED', 'UNCERTAIN'];

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
