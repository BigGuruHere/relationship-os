// Stage 8.12.10: deterministic, evidence-aware quality gates for model-proposed personal knowledge.
// This module has no database or provider imports so its selection rules can be tested directly.
export type CandidateSuggestion = {
  kind: 'FACT' | 'WANT' | 'OFFER' | 'PREFERENCE' | 'CONSTRAINT' | 'OBJECTIVE' | 'OTHER';
  statement: string;
  evidenceQuote: string;
};

const KINDS = new Set(['FACT', 'WANT', 'OFFER', 'PREFERENCE', 'CONSTRAINT', 'OBJECTIVE', 'OTHER']);
const ORDER: CandidateSuggestion['kind'][] = ['CONSTRAINT', 'WANT', 'PREFERENCE', 'OBJECTIVE', 'FACT', 'OFFER', 'OTHER'];
const normalized = (s: string) => s.replace(/\s+/g, ' ').trim().toLocaleLowerCase();

// Accept punctuation/whitespace variants only when the same sequence of words occurs
// contiguously in the original. Return ORIGINAL source bytes, never a model paraphrase.
// No semantic/fuzzy fallback: evidence must remain independently verifiable.
export function sourceEvidenceMatch(source: string, quote: string): string | null {
  const literal = normalized(quote);
  if (!literal) return null;
  // Preserve the actual source bytes: a whitespace-normalised model quote is not
  // itself verbatim evidence unless the raw source contains it exactly.
  if (source.includes(quote.trim())) return quote.trim();
  const tokenPattern = /[\p{L}\p{N}]+/gu;
  const sourceTokens = [...source.matchAll(tokenPattern)];
  const quoteTokens = [...quote.matchAll(tokenPattern)].map(match => match[0].toLocaleLowerCase());
  // Short phrases are too ambiguous to recover safely from punctuation differences.
  if (quoteTokens.length < 4 || quoteTokens.length > 130) return null;
  for (let start = 0; start + quoteTokens.length <= sourceTokens.length; start++) {
    if (!quoteTokens.every((word, offset) => sourceTokens[start + offset][0].toLocaleLowerCase() === word)) continue;
    const first = sourceTokens[start];
    const last = sourceTokens[start + quoteTokens.length - 1];
    return source.slice(first.index ?? 0, (last.index ?? 0) + last[0].length);
  }
  // IT: Speech-to-text sometimes joins two words ("alsobring") while the model
  // splits them ("also bring"). Recover ONLY one continuous, exact source
  // substring with at least 30 alphanumeric characters and no elision markers.
  // Never bridge turns or infer a quote assembled from separate passages.
  if (quote.length >= 30 && !/[.\u2026]{2,}/.test(quote)) {
    const letters = /[\p{L}\p{N}]/u;
    const key = [...quote.toLocaleLowerCase()].filter(c => letters.test(c)).join('');
    if (key.length >= 30) for (const passage of source.split(/\n\n+/)) {
      const positions: number[] = [];
      let condensed = '';
      for (let i = 0; i < passage.length; i++) {
        const char = passage[i];
        if (letters.test(char)) { condensed += char.toLocaleLowerCase(); positions.push(i); }
      }
      const at = condensed.indexOf(key);
      if (at >= 0 && condensed.indexOf(key, at + 1) < 0) {
        return passage.slice(positions[at], positions[at + key.length - 1] + 1);
      }
    }
  }
  return null;
}


export function selectKnowledgeSuggestions(rawItems: unknown[], source: string, limit = 12): CandidateSuggestion[] {
  return inspectKnowledgeSelection(rawItems, source, limit).selected;
}

// Privacy-preserving counters. No statement, quote, source text or identifiers appear in this report.
// This is a diagnostic of deterministic filters, not a claim about model quality or factual correctness.
export type KnowledgeSelectionReport = {
  inputCount: number; examinedCount: number; invalidOrUnsupportedCount: number; exactDuplicateCount: number; nearDuplicateCount: number; eligibleCount: number; displayedCount: number; beyondLimitCount: number;
  // All fields are counts only. Validation of source wording is not semantic proof of the claim.
  rejectionReasons: { malformedItem: number; invalidKind: number; invalidStatement: number; invalidSourcePassage: number; exactDuplicate: number; nearDuplicate: number; reviewLimitDeferred: number };
  selectedByKind: Record<CandidateSuggestion['kind'], number>;
  quoteReusedAcrossSelected: number; sourceMentionsUncertainty: boolean; selectedMentionsUncertainty: boolean;
};
// Diagnostic details exist only in this function's return value when explicitly requested.
// Never write them to server logs, persistent storage, analytics or model audit data.
export type RejectedKnowledgeCandidate = { pass?: string; reason: string; kind: string; statement: string; evidenceQuote: string; overlapsWith?: string };
export function inspectKnowledgeSelection(rawItems: unknown[], source: string, limit = 12, inspectRejected = false): { selected: CandidateSuggestion[]; report: KnowledgeSelectionReport; rejected: RejectedKnowledgeCandidate[] } {
  const candidates: CandidateSuggestion[] = [];
  const rejected: RejectedKnowledgeCandidate[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  let exactDuplicates = 0;
  let nearDuplicates = 0;
  const reasons = { malformedItem: 0, invalidKind: 0, invalidStatement: 0, invalidSourcePassage: 0, exactDuplicate: 0, nearDuplicate: 0, reviewLimitDeferred: 0 };
  // Record a count, never the rejected private material.
  const reject = (reason: 'malformedItem' | 'invalidKind' | 'invalidStatement' | 'invalidSourcePassage', raw: unknown) => {
    invalid++; reasons[reason]++;
    if (inspectRejected && rejected.length < 80) {
      const item = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
      rejected.push({ reason, kind: typeof item.kind === 'string' ? item.kind.slice(0, 50) : '',
        statement: typeof item.statement === 'string' ? item.statement.slice(0, 650) : '',
        evidenceQuote: typeof item.evidenceQuote === 'string' ? item.evidenceQuote.slice(0, 850) : '' });
    }
  };
  for (const raw of rawItems.slice(0, 80)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { reject('malformedItem', raw); continue; }
    const item = raw as Record<string, unknown>;
    if (typeof item.kind !== 'string' || !KINDS.has(item.kind)) { reject('invalidKind', raw); continue; }
    if (typeof item.statement !== 'string' || typeof item.evidenceQuote !== 'string') { reject('malformedItem', raw); continue; }
    const statement = item.statement.trim();
    const quote = item.evidenceQuote.trim();
    // Do not let a plausible-sounding model inference through without literal source evidence.
    if (!statement || statement.length > 600) { reject('invalidStatement', raw); continue; }
    const verifiedQuote = quote.length <= 800 ? sourceEvidenceMatch(source, quote) : null;
    if (!verifiedQuote) { reject('invalidSourcePassage', raw); continue; }
    const kind = item.kind as CandidateSuggestion['kind'];
    const key = `${kind}:${normalized(statement)}`;
    if (seen.has(key)) {
      exactDuplicates++; reasons.exactDuplicate++;
      if (inspectRejected && rejected.length < 80) rejected.push({ reason: 'exactDuplicate', kind, statement, evidenceQuote: quote, overlapsWith: statement });
      continue;
    }
    seen.add(key);
    candidates.push({ kind, statement, evidenceQuote: verifiedQuote });
  }

  // Prefer durable, current, qualified understanding to an isolated attendance fact.
  // This is review ordering only, never an inference of truth or permission to disclose.
  const uncertainty = /\b(unsure|uncertain|not sure|hesitant|might|may|not ready|whether|perhaps|but)\b/i;
  const historicalOnly = /\b(last (saturday|sunday|week|month)|yesterday|attended|went to|met at)\b/i;
  const qualify = (item: CandidateSuggestion) =>
    (uncertainty.test(`${item.statement} ${item.evidenceQuote}`) ? 10 : 0) +
    (item.kind === 'CONSTRAINT' ? 5 : 0) +
    (historicalOnly.test(item.statement) && item.kind === 'FACT' ? -8 : 0);
  // Collapse near-verbatim repetitions within a kind, not distinct wishes and
  // constraints. Both the quote and original proposal remain available in history.
  const words = (value: string) => new Set(normalized(value).split(/[^a-z0-9]+/).filter(w => w.length > 3));
  const overlap = (a: string, b: string) => {
    const wa = words(a), wb = words(b);
    const common = [...wa].filter(w => wb.has(w)).length;
    return common / Math.max(1, Math.min(wa.size, wb.size));
  };
  // A hedge, negation or temporary qualifier can materially change a similar-sounding
  // statement. Protect these distinctions even when a lexical near-duplicate is detected.
  // This is deliberately conservative; no deterministic filter can establish meaning.
  const qualificationSignature = (statement: string) => ({
    uncertain: /\b(unsure|uncertain|not sure|hesitant|might|may|perhaps|whether|questioning)\b/i.test(statement),
    negative: /\b(not|never|no|without|cannot|can't|don't|doesn't)\b/i.test(statement),
    temporary: /\b(currently|for now|at present|at the moment|sometimes|recently)\b/i.test(statement),
    readiness: /\b(ready|readiness|commitment|committed)\b/i.test(statement)
  });
  const sameQualification = (a: string, b: string) => JSON.stringify(qualificationSignature(a)) === JSON.stringify(qualificationSignature(b));
  const distinct: CandidateSuggestion[] = [];
  for (const candidate of [...candidates].sort((a,b) => qualify(b) - qualify(a))) {
    const duplicate = distinct.find(previous => previous.kind === candidate.kind && sameQualification(previous.statement, candidate.statement) && overlap(previous.statement, candidate.statement) >= 0.82);
    if (duplicate) {
      nearDuplicates++; reasons.nearDuplicate++;
      if (inspectRejected && rejected.length < 80) rejected.push({ reason: 'nearDuplicate', kind: candidate.kind, statement: candidate.statement, evidenceQuote: candidate.evidenceQuote, overlapsWith: duplicate.statement });
      continue;
    }
    distinct.push(candidate);
  }
  // First-page diversity is preserved, but additional valid statements are kept
  // for later review pages rather than being silently discarded at item twelve.
  const byKind = new Map(ORDER.map(kind => [kind, distinct.filter(item => item.kind === kind)] as const));
  const selected: CandidateSuggestion[] = [];
  while (selected.length < limit) {
    let added = false;
    for (const kind of ORDER) {
      const next = byKind.get(kind)?.shift();
      if (!next) continue;
      selected.push(next);
      added = true;
      if (selected.length === limit) break;
    }
    if (!added) break;
  }
  reasons.reviewLimitDeferred = Math.max(0, distinct.length - selected.length);
  const counts = Object.fromEntries([...KINDS].map(kind => [kind, selected.filter(item => item.kind === kind).length])) as Record<CandidateSuggestion['kind'], number>;
  const quotes = new Set<string>();
  let reused = 0;
  for (const item of selected) {
    const quote = normalized(item.evidenceQuote);
    if (quotes.has(quote)) reused++;
    quotes.add(quote);
  }
  const explicitUncertainty = /\b(unsure|uncertain|not sure|hesitant|might|may|not ready|whether|perhaps|not entirely sure)\b/i;
  if (inspectRejected) for (const candidate of distinct.filter(item => !selected.includes(item)).slice(0, 80 - rejected.length)) {
    rejected.push({ reason: 'reviewLimitDeferred', kind: candidate.kind, statement: candidate.statement, evidenceQuote: candidate.evidenceQuote });
  }
  return { selected, rejected, report: {
    inputCount: rawItems.length, examinedCount: Math.min(rawItems.length, 80),
    invalidOrUnsupportedCount: invalid, exactDuplicateCount: exactDuplicates,
    nearDuplicateCount: nearDuplicates, eligibleCount: distinct.length, rejectionReasons: reasons,
    displayedCount: selected.length, beyondLimitCount: Math.max(0, distinct.length - selected.length),
    selectedByKind: counts, quoteReusedAcrossSelected: reused,
    sourceMentionsUncertainty: explicitUncertainty.test(source),
    selectedMentionsUncertainty: selected.some(item => explicitUncertainty.test(`${item.statement} ${item.evidenceQuote}`))
  }};
}

export function suggestedCoverage(items: CandidateSuggestion[]): string[] {
  // High-level, explainable coverage summary for the operator, not a personality score.
  return ORDER.filter(kind => items.some(item => item.kind === kind));
}
