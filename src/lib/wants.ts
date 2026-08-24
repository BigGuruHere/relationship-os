// src/lib/wants.ts
// PURPOSE: Browser-safe labels and normalisers for first-class Wants.
// NOTE: Server-only encryption/DB helpers live in src/lib/server/wants.ts.

import {
  EXCHANGE_CONFIDENCES,
  EXCHANGE_TIME_HORIZONS,
  EXCHANGE_URGENCIES,
  exchangeConfidenceLabel,
  exchangeTimeHorizonLabel,
  exchangeUrgencyLabel,
  importanceLabel as exchangeImportanceLabel,
  normaliseExchangeConfidence,
  normaliseExchangeTimeHorizon,
  normaliseExchangeUrgency
} from '$lib/exchange';

export { EXCHANGE_CONFIDENCES as WANT_CONFIDENCES, EXCHANGE_TIME_HORIZONS as WANT_TIME_HORIZONS, EXCHANGE_URGENCIES as WANT_URGENCIES };
export { exchangeConfidenceLabel as wantConfidenceLabel, exchangeTimeHorizonLabel as wantTimeHorizonLabel, exchangeUrgencyLabel as wantUrgencyLabel, exchangeImportanceLabel as importanceLabel };
export { normaliseExchangeConfidence as normaliseWantConfidence, normaliseExchangeTimeHorizon as normaliseWantTimeHorizon, normaliseExchangeUrgency as normaliseWantUrgency };

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

export const WANT_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'CLARIFYING_CRITERIA', label: 'Clarifying criteria' },
  { value: 'ACTIVE_MANDATE', label: 'Active mandate' },
  { value: 'WATCHING_MARKET', label: 'Watching market' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'CONVERTED_TO_DEAL', label: 'Converted to deal' },
  { value: 'CLOSED_INACTIVE', label: 'Closed / inactive' },
  { value: 'ARCHIVED', label: 'Archived' }
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
export const wantStatusLabel = (v: string | null | undefined) => labelFrom(WANT_STATUSES, v, 'New');
export const normaliseWantType = (v: FormDataEntryValue | null) => normaliseFrom(WANT_TYPES, v, 'GENERAL');
export const normaliseWantStatus = (v: FormDataEntryValue | null) => normaliseFrom(WANT_STATUSES, v, 'NEW');

export function dateToInputDate(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}
