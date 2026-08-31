// src/lib/wants.ts
// PURPOSE: Browser-safe labels and normalisers for first-class Wants.
// NOTE: Server-only encryption/DB helpers live in src/lib/server/wants.ts.

import {
  INTENT_CONFIDENCES,
  INTENT_STATUSES,
  INTENT_TIME_HORIZONS,
  INTENT_URGENCIES,
  intentConfidenceLabel,
  intentStatusLabel,
  intentTimeHorizonLabel,
  intentUrgencyLabel,
  importanceLabel as intentImportanceLabel,
  normaliseIntentConfidence,
  normaliseIntentStatus,
  normaliseIntentTimeHorizon,
  normaliseIntentUrgency
} from '$lib/intents';

export { INTENT_CONFIDENCES as WANT_CONFIDENCES, INTENT_STATUSES as WANT_STATUSES, INTENT_TIME_HORIZONS as WANT_TIME_HORIZONS, INTENT_URGENCIES as WANT_URGENCIES };
export { intentConfidenceLabel as wantConfidenceLabel, intentStatusLabel as wantStatusLabel, intentTimeHorizonLabel as wantTimeHorizonLabel, intentUrgencyLabel as wantUrgencyLabel, intentImportanceLabel as importanceLabel };
export { normaliseIntentConfidence as normaliseWantConfidence, normaliseIntentStatus as normaliseWantStatus, normaliseIntentTimeHorizon as normaliseWantTimeHorizon, normaliseIntentUrgency as normaliseWantUrgency };

export const WANT_TYPES = [
  { value: 'GENERAL', label: 'General want' },
  { value: 'ACQUISITION_CRITERIA', label: 'Acquisition criteria' },
  { value: 'BUYER_MANDATE', label: 'Buyer mandate' },
  { value: 'REFERRAL_REQUEST', label: 'Referral request' },
  { value: 'SERVICE_NEED', label: 'Service need' },
  { value: 'ASSET_SEARCH', label: 'Asset search' },
  { value: 'FUNDING_NEED', label: 'Funding need' },
  { value: 'PARTNERSHIP_INTEREST', label: 'Partnership interest' },
  { value: 'TALENT_NEED', label: 'Talent need' },
  { value: 'OTHER', label: 'Other' }
] as const;

type Opt = { readonly value: string; readonly label: string };

function labelFrom(options: readonly Opt[], value: string | null | undefined, fallback = '') {
  return options.find((o) => o.value === String(value || ''))?.label || fallback || String(value || '');
}

function normaliseFrom<T extends readonly Opt[]>(options: T, value: FormDataEntryValue | null, fallback: T[number]['value']) {
  const raw = String(value || '').trim().toUpperCase();
  return (options.some((o) => o.value === raw) ? raw : fallback) as T[number]['value'];
}

export const wantTypeLabel = (v: string | null | undefined) => labelFrom(WANT_TYPES, v, 'General want');
export const normaliseWantType = (v: FormDataEntryValue | null) => normaliseFrom(WANT_TYPES, v, 'GENERAL');

export { dateToInputDate } from '$lib/intents';
