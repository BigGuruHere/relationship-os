// Stage 8.12.12: deterministic operator validation and shared-topic candidates. No database access.
export const COMPARISON_KINDS = ['INDEPENDENT', 'SUPPORTS', 'REFINES', 'POTENTIAL_CONFLICT', 'SUPERSEDES'] as const;
export type ComparisonKind = typeof COMPARISON_KINDS[number];

export function validateComparison(input: { newerClaimId: string; olderClaimId: string; relationship: string; note?: string; acknowledgeSupersession?: boolean }) {
  if (!/^[0-9a-f-]{36}$/i.test(input.newerClaimId) || !/^[0-9a-f-]{36}$/i.test(input.olderClaimId) || input.newerClaimId === input.olderClaimId) throw new Error('Choose two distinct statements belonging to this person.');
  if (!COMPARISON_KINDS.includes(input.relationship as ComparisonKind)) throw new Error('Choose a valid knowledge relationship.');
  const relationship = input.relationship as ComparisonKind;
  if (relationship === 'SUPERSEDES' && !input.acknowledgeSupersession) throw new Error('Explicitly acknowledge retirement of the earlier statement.');
  const note = String(input.note ?? '').replace(/\s+/g, ' ').trim();
  if (note.length > 1000) throw new Error('Comparison note must be no longer than 1000 characters.');
  return { ...input, relationship, note };
}

// A common topic is required. A mere shared word must never silently create a relationship.
export function sharedTopicCandidates(topicTree: { topics: { id: string; name: string; claims: { id: string }[] }[] }[], claimId: string) {
  const matching = topicTree.flatMap(realm => realm.topics.filter(topic => topic.claims.some(claim => claim.id === claimId)));
  const candidates = new Map<string, string[]>();
  for (const topic of matching) for (const claim of topic.claims) {
    if (claim.id === claimId) continue;
    candidates.set(claim.id, [...new Set([...(candidates.get(claim.id) ?? []), topic.name])]);
  }
  return [...candidates].map(([id, topics]) => ({ id, topics }));
}

