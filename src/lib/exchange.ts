// src/lib/exchange.ts
// PURPOSE: Shared labels and form helpers for wants/offers exchange items.
// NOTE: Keep this browser-safe. Server-only encryption and DB helpers live in src/lib/server/exchange.ts.

export const EXCHANGE_TYPES = [
  { value: 'WANT', label: 'Want' },
  { value: 'OFFER', label: 'Offer' }
] as const;

export const EXCHANGE_DIRECTIONS = [
  { value: 'SEEKING', label: 'Seeking' },
  { value: 'OFFERING', label: 'Offering' },
  { value: 'OPEN_TO', label: 'Open to' },
  { value: 'NOT_INTERESTED_IN', label: 'Not interested in' },
  { value: 'OTHER', label: 'Other' }
] as const;

export const EXCHANGE_URGENCIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'IMMEDIATE', label: 'Immediate' }
] as const;

export const EXCHANGE_TIME_HORIZONS = [
  { value: 'NOW', label: 'Now' },
  { value: 'NEXT_30_DAYS', label: 'Next 30 days' },
  { value: 'NEXT_90_DAYS', label: 'Next 90 days' },
  { value: 'THIS_YEAR', label: 'This year' },
  { value: 'LATER', label: 'Later' },
  { value: 'ONGOING', label: 'Ongoing' }
] as const;

export const EXCHANGE_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'ARCHIVED', label: 'Archived' }
] as const;

export const EXCHANGE_CONFIDENCES = [
  { value: 'LOW', label: 'Low confidence' },
  { value: 'MEDIUM', label: 'Medium confidence' },
  { value: 'HIGH', label: 'High confidence' }
] as const;

type Opt = { readonly value: string; readonly label: string };

function labelFrom(options: readonly Opt[], value: string | null | undefined, fallback = '') {
  return options.find((o) => o.value === String(value || ''))?.label || fallback || String(value || '');
}

function normaliseFrom<T extends readonly Opt[]>(options: T, value: FormDataEntryValue | null, fallback: T[number]['value']) {
  const raw = String(value || '').trim().toUpperCase();
  return (options.some((o) => o.value === raw) ? raw : fallback) as T[number]['value'];
}

export const exchangeTypeLabel = (v: string | null | undefined) => labelFrom(EXCHANGE_TYPES, v, 'Want');
export const exchangeDirectionLabel = (v: string | null | undefined) => labelFrom(EXCHANGE_DIRECTIONS, v, 'Other');
export const exchangeUrgencyLabel = (v: string | null | undefined) => labelFrom(EXCHANGE_URGENCIES, v, 'Normal');
export const exchangeTimeHorizonLabel = (v: string | null | undefined) => labelFrom(EXCHANGE_TIME_HORIZONS, v, 'Ongoing');
export const exchangeStatusLabel = (v: string | null | undefined) => labelFrom(EXCHANGE_STATUSES, v, 'Active');
export const exchangeConfidenceLabel = (v: string | null | undefined) => labelFrom(EXCHANGE_CONFIDENCES, v, 'Medium confidence');

export const normaliseExchangeType = (v: FormDataEntryValue | null) => normaliseFrom(EXCHANGE_TYPES, v, 'WANT');
export const normaliseExchangeDirection = (v: FormDataEntryValue | null) => normaliseFrom(EXCHANGE_DIRECTIONS, v, 'OTHER');
export const normaliseExchangeUrgency = (v: FormDataEntryValue | null) => normaliseFrom(EXCHANGE_URGENCIES, v, 'NORMAL');
export const normaliseExchangeTimeHorizon = (v: FormDataEntryValue | null) => normaliseFrom(EXCHANGE_TIME_HORIZONS, v, 'ONGOING');
export const normaliseExchangeStatus = (v: FormDataEntryValue | null) => normaliseFrom(EXCHANGE_STATUSES, v, 'ACTIVE');
export const normaliseExchangeConfidence = (v: FormDataEntryValue | null) => normaliseFrom(EXCHANGE_CONFIDENCES, v, 'MEDIUM');

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
