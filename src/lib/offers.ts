// src/lib/offers.ts
// PURPOSE: Browser-safe labels and normalisers for first-class Offers.

import {
  INTENT_CONFIDENCES,
  INTENT_DIRECTIONS,
  INTENT_STATUSES,
  INTENT_TIME_HORIZONS,
  INTENT_URGENCIES,
  dateToInputDate,
  intentConfidenceLabel,
  intentDirectionLabel,
  intentStatusLabel,
  intentTimeHorizonLabel,
  intentUrgencyLabel,
  importanceLabel,
  normaliseIntentConfidence,
  normaliseIntentDirection,
  normaliseIntentStatus,
  normaliseIntentTimeHorizon,
  normaliseIntentUrgency
} from '$lib/intents';

export { INTENT_CONFIDENCES as OFFER_CONFIDENCES, INTENT_DIRECTIONS as OFFER_DIRECTIONS, INTENT_STATUSES as OFFER_STATUSES, INTENT_TIME_HORIZONS as OFFER_TIME_HORIZONS, INTENT_URGENCIES as OFFER_URGENCIES, dateToInputDate, intentConfidenceLabel as offerConfidenceLabel, intentDirectionLabel as offerDirectionLabel, intentStatusLabel as offerStatusLabel, intentTimeHorizonLabel as offerTimeHorizonLabel, intentUrgencyLabel as offerUrgencyLabel, importanceLabel, normaliseIntentConfidence as normaliseOfferConfidence, normaliseIntentDirection as normaliseOfferDirection, normaliseIntentStatus as normaliseOfferStatus, normaliseIntentTimeHorizon as normaliseOfferTimeHorizon, normaliseIntentUrgency as normaliseOfferUrgency };

export const OFFER_TYPES = [
  { value: 'GENERAL', label: 'General offer' },
  { value: 'SELLER_OPPORTUNITY', label: 'Seller opportunity' },
  { value: 'AVAILABLE_ASSET', label: 'Available asset' },
  { value: 'INTRODUCTION', label: 'Introduction' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'CAPITAL', label: 'Capital' },
  { value: 'EXPERTISE', label: 'Expertise' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
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

export const offerTypeLabel = (v: string | null | undefined) => labelFrom(OFFER_TYPES, v, 'General offer');
export const normaliseOfferType = (v: FormDataEntryValue | null) => normaliseFrom(OFFER_TYPES, v, 'GENERAL');
