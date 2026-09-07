// PURPOSE: Define the reusable MarketLead next-action vocabulary and client-safe normalization.
// IT: Defaults are intentionally small. Workspace-specific additions are persisted server-side.

export const DEFAULT_LEAD_NEXT_ACTIONS = [
  'Initiate contact',
  'Initial follow-up',
  'Await response',
  'Nurture contact',
  'Research / find details',
  'No further action'
] as const;

export const MAX_LEAD_NEXT_ACTION_LENGTH = 120;

export function normaliseLeadNextActionLabel(input: string) {
  return String(input || '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function validateLeadNextActionLabel(input: string): string | null {
  const label = normaliseLeadNextActionLabel(input);
  if (!label) return '';
  if (label.length > MAX_LEAD_NEXT_ACTION_LENGTH) return null;
  return label;
}

export function mergeLeadNextActionOptions(custom: string[], current = '') {
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (raw: string) => {
    const label = normaliseLeadNextActionLabel(raw);
    if (!label) return;
    const key = label.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(label);
  };

  for (const label of DEFAULT_LEAD_NEXT_ACTIONS) add(label);
  for (const label of custom) add(label);
  add(current);
  return result;
}
