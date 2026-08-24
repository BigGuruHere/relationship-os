// src/lib/offers.ts
// PURPOSE: Browser-safe labels and normalisers for first-class Offers.

import {
  EXCHANGE_CONFIDENCES,
  EXCHANGE_DIRECTIONS,
  EXCHANGE_TIME_HORIZONS,
  EXCHANGE_URGENCIES,
  dateToInputDate,
  exchangeConfidenceLabel,
  exchangeDirectionLabel,
  exchangeTimeHorizonLabel,
  exchangeUrgencyLabel,
  importanceLabel,
  normaliseExchangeConfidence,
  normaliseExchangeDirection,
  normaliseExchangeTimeHorizon,
  normaliseExchangeUrgency
} from '$lib/exchange';

export { EXCHANGE_CONFIDENCES as OFFER_CONFIDENCES, EXCHANGE_DIRECTIONS as OFFER_DIRECTIONS, EXCHANGE_TIME_HORIZONS as OFFER_TIME_HORIZONS, EXCHANGE_URGENCIES as OFFER_URGENCIES, dateToInputDate, exchangeConfidenceLabel as offerConfidenceLabel, exchangeDirectionLabel as offerDirectionLabel, exchangeTimeHorizonLabel as offerTimeHorizonLabel, exchangeUrgencyLabel as offerUrgencyLabel, importanceLabel, normaliseExchangeConfidence as normaliseOfferConfidence, normaliseExchangeDirection as normaliseOfferDirection, normaliseExchangeTimeHorizon as normaliseOfferTimeHorizon, normaliseExchangeUrgency as normaliseOfferUrgency };

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

export const OFFER_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'CLARIFYING_SUPPLY', label: 'Clarifying supply' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'WATCHING_INTEREST', label: 'Watching interest' },
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

export const offerTypeLabel = (v: string | null | undefined) => labelFrom(OFFER_TYPES, v, 'General offer');
export const offerStatusLabel = (v: string | null | undefined) => labelFrom(OFFER_STATUSES, v, 'New');
export const normaliseOfferType = (v: FormDataEntryValue | null) => normaliseFrom(OFFER_TYPES, v, 'GENERAL');
export const normaliseOfferStatus = (v: FormDataEntryValue | null) => normaliseFrom(OFFER_STATUSES, v, 'NEW');
