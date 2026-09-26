// Stage 8.12.11 - Explainable, deterministic placement hints for operator review.
// These are local suggestions, not a model's judgement, consent, or automatic assignment.
// Never log or persist private statement text or proposed placements here.
export type PlacementRealmKey = 'romantic_relationships' | 'friendships' | 'work' | 'family' | 'interests' | 'direction' | 'other';
export type PlacementTopic = { id: string; name: string; realmKey: string; realmName: string };
export type PlacementHint = { topicId: string | null; topicName: string; realmKey: PlacementRealmKey; realmName: string; reason: string; isNew: boolean };

const REALM_LABELS: Record<PlacementRealmKey, string> = {
  romantic_relationships: 'Romantic relationships', friendships: 'Friendships and social life',
  work: 'Work and business', family: 'Family', interests: 'Lifestyle and interests',
  direction: 'Values and life direction', other: 'Other and emerging'
};
// Distinct themes take precedence over broad terms like 'relationship' or 'work'.
// A single statement may carry multiple themes: show several hints, never choose silently.
const THEMES: { realm: PlacementRealmKey; topic: string; patterns: RegExp[] }[] = [
  { realm: 'romantic_relationships', topic: 'Relationship readiness', patterns: [/ready to (date|commit|start a relationship)/i, /not (sure|ready).{0,40}(relationship|commitment|dating)/i, /uncertain.{0,40}(commitment|relationship)/i, /readiness/i] },
  { realm: 'romantic_relationships', topic: 'Preferred partner', patterns: [/partner (who|with|that)/i, /looking for (someone|a partner)/i, /attracted to/i, /qualities in (a|my) partner/i] },
  { realm: 'romantic_relationships', topic: 'Desired relationship', patterns: [/romantic relationship/i, /want.{0,35}(relationship|romance|partner)/i, /closeness.{0,40}(independence|individuality)/i, /relationship.{0,40}(independence|individuality)/i] },
  { realm: 'friendships', topic: 'Developing friendships', patterns: [/friendship/i, /make (new |more )?friends/i, /develop.{0,30}friends/i, /social circle/i, /lonel/i] },
  { realm: 'friendships', topic: 'Social preferences', patterns: [/small(er)? (groups?|gatherings?)/i, /natural (introductions?|connections?)/i, /social (events?|settings?)/i, /large (crowds?|groups?)/i] },
  { realm: 'work', topic: 'Work and ambitions', patterns: [/career/i, /business/i, /professional/i, /work ambitions?/i, /job/i, /employment/i] },
  { realm: 'family', topic: 'Family relationships', patterns: [/family/i, /children/i, /daughter/i, /son\b/i, /parent/i] },
  { realm: 'interests', topic: 'Activities and interests', patterns: [/tennis/i, /music/i, /hobbies?/i, /walking/i, /sport/i, /exercise/i, /art\b/i] },
  { realm: 'direction', topic: 'Values and life direction', patterns: [/values?/i, /purpose/i, /life direction/i, /meaningful life/i] }
];
const STOP = new Set(['with','that','this','have','from','into','their','there','about','would','could','should','prefer','wants','want','some','more','less','being','person','people','relationship','relationships','life','current','knowledge','topic']);
function tokens(s: string): Set<string> { return new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(w => !STOP.has(w))); }
function overlap(a: string, b: string): number { const x = tokens(a), y = tokens(b); return [...x].filter(word => y.has(word)).length; }
function isRealmKey(s: string): s is PlacementRealmKey { return s in REALM_LABELS; }

export function suggestTopicPlacement(statement: string, kind: string, topics: PlacementTopic[], max = 3): PlacementHint[] {
  const matchingThemes = THEMES.map(theme => ({ theme, strength: theme.patterns.filter(pattern => pattern.test(statement)).length }))
    .filter(match => match.strength > 0).sort((a, b) => b.strength - a.strength);
  const scored = topics.filter(topic => isRealmKey(topic.realmKey)).map(topic => {
    const themeScore = matchingThemes.reduce((score, match) => score + (match.theme.realm === topic.realmKey ?
      (match.theme.topic.toLowerCase() === topic.name.toLowerCase() ? 6 : 1) * match.strength : 0), 0);
    return { topic, score: themeScore + overlap(statement, topic.name) * 3, themeScore };
  }).filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.topic.name.localeCompare(b.topic.name));
  const results: PlacementHint[] = scored.slice(0, max).map(row => ({
    topicId: row.topic.id, topicName: row.topic.name, realmKey: row.topic.realmKey as PlacementRealmKey,
    realmName: row.topic.realmName, isNew: false,
    reason: row.themeScore ? 'The statement concerns this area of life and may fit this existing topic.' : 'The statement and topic share relevant wording; please check the meaning.'
  }));
  // Propose a missing topic only if the text gives specific evidence for it.
  for (const { theme } of matchingThemes) {
    if (results.length >= max) break;
    if (!topics.some(topic => topic.realmKey === theme.realm && topic.name.toLowerCase() === theme.topic.toLowerCase())) {
      results.push({ topicId: null, topicName: theme.topic, realmKey: theme.realm, realmName: REALM_LABELS[theme.realm],
        reason: 'The statement mentions this theme, but a topic with this name does not exist yet. Review the name before creating it.', isNew: true });
    }
  }
  // No evidence means no guessed topic. The operator can always choose manually.
  return results.slice(0, max);
}
