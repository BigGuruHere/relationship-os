// src/lib/objectives.ts
// PURPOSE: Browser-safe Objective helpers. Objectives intentionally reuse the neutral Intent lifecycle from Stage 8.3.

import { INTENT_STATUSES, INTENT_CONFIDENCES } from '$lib/intents';

export const OBJECTIVE_STATUSES = INTENT_STATUSES;
export const OBJECTIVE_CONFIDENCES = INTENT_CONFIDENCES;

export function objectiveStatusLabel(value: string | null | undefined) {
  return OBJECTIVE_STATUSES.find((o) => o.value === String(value || ''))?.label || String(value || '');
}

export function objectiveConfidenceLabel(value: string | null | undefined) {
  return OBJECTIVE_CONFIDENCES.find((o) => o.value === String(value || ''))?.label || String(value || '');
}
