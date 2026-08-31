// src/lib/intents.ts
// PURPOSE: Browser-safe shared semantics for canonical Wants and Offers.
// Stage 8.3 removes the legacy ExchangeItem domain model; these concepts are now neutral intent metadata.

export const INTENT_DIRECTIONS = [
  { value: 'SEEKING', label: 'Seeking' },
  { value: 'OFFERING', label: 'Offering' },
  { value: 'OPEN_TO', label: 'Open to' },
  { value: 'NOT_INTERESTED_IN', label: 'Not interested in' },
  { value: 'OTHER', label: 'Other' }
] as const;

export const INTENT_URGENCIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'IMMEDIATE', label: 'Immediate' }
] as const;

export const INTENT_TIME_HORIZONS = [
  { value: 'NOW', label: 'Now' },
  { value: 'NEXT_30_DAYS', label: 'Next 30 days' },
  { value: 'NEXT_90_DAYS', label: 'Next 90 days' },
  { value: 'THIS_YEAR', label: 'This year' },
  { value: 'LATER', label: 'Later' },
  { value: 'ONGOING', label: 'Ongoing' }
] as const;

// IT: Lifecycle is intentionally domain-neutral. Match/deal state is recorded elsewhere rather than becoming intent lifecycle.
export const INTENT_STATUSES = [
  { value: 'CAPTURED', label: 'Captured' },
  { value: 'CLARIFYING', label: 'Clarifying' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'ARCHIVED', label: 'Archived' }
] as const;

export const INTENT_CONFIDENCES = [
  { value: 'LOW', label: 'Low confidence' },
  { value: 'MEDIUM', label: 'Medium confidence' },
  { value: 'HIGH', label: 'High confidence' }
] as const;

type Opt = { readonly value: string; readonly label: string };

export function labelFrom(options: readonly Opt[], value: string | null | undefined, fallback = '') {
  return options.find((o) => o.value === String(value || ''))?.label || fallback || String(value || '');
}

export function normaliseFrom<T extends readonly Opt[]>(options: T, value: FormDataEntryValue | null, fallback: T[number]['value']) {
  const raw = String(value || '').trim().toUpperCase();
  return (options.some((o) => o.value === raw) ? raw : fallback) as T[number]['value'];
}

export const intentDirectionLabel = (v: string | null | undefined) => labelFrom(INTENT_DIRECTIONS, v, 'Other');
export const intentUrgencyLabel = (v: string | null | undefined) => labelFrom(INTENT_URGENCIES, v, 'Normal');
export const intentTimeHorizonLabel = (v: string | null | undefined) => labelFrom(INTENT_TIME_HORIZONS, v, 'Ongoing');
export const intentStatusLabel = (v: string | null | undefined) => labelFrom(INTENT_STATUSES, v, 'Captured');
export const intentConfidenceLabel = (v: string | null | undefined) => labelFrom(INTENT_CONFIDENCES, v, 'Medium confidence');

export const normaliseIntentDirection = (v: FormDataEntryValue | null) => normaliseFrom(INTENT_DIRECTIONS, v, 'OTHER');
export const normaliseIntentUrgency = (v: FormDataEntryValue | null) => normaliseFrom(INTENT_URGENCIES, v, 'NORMAL');
export const normaliseIntentTimeHorizon = (v: FormDataEntryValue | null) => normaliseFrom(INTENT_TIME_HORIZONS, v, 'ONGOING');
export const normaliseIntentStatus = (v: FormDataEntryValue | null) => normaliseFrom(INTENT_STATUSES, v, 'CAPTURED');
export const normaliseIntentConfidence = (v: FormDataEntryValue | null) => normaliseFrom(INTENT_CONFIDENCES, v, 'MEDIUM');

export function importanceLabel(value: number | string | null | undefined) {
  const n = Number(value ?? 3);
  if (n <= 1) return 'Low';
  if (n === 2) return 'Useful';
  if (n === 3) return 'Important';
  if (n === 4) return 'High value';
  return 'Critical';
}

export function dateToInputDate(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}
