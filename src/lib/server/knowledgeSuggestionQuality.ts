// Stage 8.12.5: deterministic quality gates for model-proposed personal knowledge.
// This module has no database or provider imports so its selection rules can be tested directly.
export type CandidateSuggestion = {
  kind: 'FACT' | 'WANT' | 'OFFER' | 'PREFERENCE' | 'CONSTRAINT' | 'OBJECTIVE' | 'OTHER';
  statement: string;
  evidenceQuote: string;
};

const KINDS = new Set(['FACT', 'WANT', 'OFFER', 'PREFERENCE', 'CONSTRAINT', 'OBJECTIVE', 'OTHER']);
const ORDER: CandidateSuggestion['kind'][] = ['CONSTRAINT', 'WANT', 'PREFERENCE', 'OBJECTIVE', 'FACT', 'OFFER', 'OTHER'];
const normalized = (s: string) => s.replace(/\s+/g, ' ').trim().toLocaleLowerCase();

export function selectKnowledgeSuggestions(rawItems: unknown[], source: string, limit = 12): CandidateSuggestion[] {
  return inspectKnowledgeSelection(rawItems, source, limit).selected;
}

// Privacy-preserving counters. No statement, quote, source text or identifiers appear in this report.
// This is a diagnostic of deterministic filters, not a claim about model quality or factual correctness.
export type KnowledgeSelectionReport = {
  inputCount: number; examinedCount: number; invalidOrUnsupportedCount: number; exactDuplicateCount: number; nearDuplicateCount: number; eligibleCount: number; displayedCount: number; beyondLimitCount: number;
  selectedByKind: Record<CandidateSuggestion['kind'], number>;
  quoteReusedAcrossSelected: number; sourceMentionsUncertainty: boolean; selectedMentionsUncertainty: boolean;
};
export function inspectKnowledgeSelection(rawItems: unknown[], source: string, limit = 12): { selected: CandidateSuggestion[]; report: KnowledgeSelectionReport } {
  const candidates: CandidateSuggestion[] = [];
  const seen = new Set<string>();
  const sourceNormalized = normalized(source);
  let invalid = 0;
  let exactDuplicates = 0;
  let nearDuplicates = 0;
  for (const raw of rawItems.slice(0, 80)) {
    if (!raw || typeof raw !== 'object') { invalid++; continue; }
    const item = raw as Record<string, unknown>;
    if (typeof item.kind !== 'string' || !KINDS.has(item.kind)) { invalid++; continue; }
    if (typeof item.statement !== 'string' || typeof item.evidenceQuote !== 'string') { invalid++; continue; }
    const statement = item.statement.trim();
    const quote = item.evidenceQuote.trim();
    // Do not let a plausible-sounding model inference through without literal source evidence.
    if (!statement || statement.length > 600 || !quote || quote.length > 800 || !sourceNormalized.includes(normalized(quote))) { invalid++; continue; }
    const kind = item.kind as CandidateSuggestion['kind'];
    const key = `${kind}:${normalized(statement)}`;
    if (seen.has(key)) { exactDuplicates++; continue; }
    seen.add(key);
    candidates.push({ kind, statement, evidenceQuote: quote });
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
  const distinct: CandidateSuggestion[] = [];
  for (const candidate of [...candidates].sort((a,b) => qualify(b) - qualify(a))) {
    if (distinct.some(previous => previous.kind === candidate.kind && overlap(previous.statement, candidate.statement) >= 0.82)) { nearDuplicates++; continue; }
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
  const counts = Object.fromEntries([...KINDS].map(kind => [kind, selected.filter(item => item.kind === kind).length])) as Record<CandidateSuggestion['kind'], number>;
  const quotes = new Set<string>();
  let reused = 0;
  for (const item of selected) {
    const quote = normalized(item.evidenceQuote);
    if (quotes.has(quote)) reused++;
    quotes.add(quote);
  }
  const explicitUncertainty = /\b(unsure|uncertain|not sure|hesitant|might|may|not ready|whether|perhaps|not entirely sure)\b/i;
  return { selected, report: {
    inputCount: rawItems.length, examinedCount: Math.min(rawItems.length, 80),
    invalidOrUnsupportedCount: invalid, exactDuplicateCount: exactDuplicates,
    nearDuplicateCount: nearDuplicates, eligibleCount: distinct.length,
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
