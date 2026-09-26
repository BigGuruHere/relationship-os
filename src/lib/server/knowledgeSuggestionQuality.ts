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
  const candidates: CandidateSuggestion[] = [];
  const seen = new Set<string>();
  const sourceNormalized = normalized(source);
  for (const raw of rawItems.slice(0, 80)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.kind !== 'string' || !KINDS.has(item.kind)) continue;
    if (typeof item.statement !== 'string' || typeof item.evidenceQuote !== 'string') continue;
    const statement = item.statement.trim();
    const quote = item.evidenceQuote.trim();
    // Do not let a plausible-sounding model inference through without literal source evidence.
    if (!statement || statement.length > 600 || !quote || quote.length > 800 || !sourceNormalized.includes(normalized(quote))) continue;
    const kind = item.kind as CandidateSuggestion['kind'];
    const key = `${kind}:${normalized(statement)}`;
    if (seen.has(key)) continue;
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
    if (distinct.some(previous => previous.kind === candidate.kind && overlap(previous.statement, candidate.statement) >= 0.82)) continue;
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
  return selected;
}

export function suggestedCoverage(items: CandidateSuggestion[]): string[] {
  // High-level, explainable coverage summary for the operator, not a personality score.
  return ORDER.filter(kind => items.some(item => item.kind === kind));
}
