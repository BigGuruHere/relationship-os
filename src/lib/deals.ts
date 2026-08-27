// src/lib/deals.ts
// PURPOSE: Shared deal helpers for labels, parsing, currency, and safe decryption.
// SECURITY: Only call decrypt helpers from server load or server action code.

import { decrypt } from '$lib/crypto';

export const DEAL_STATUSES = [
  { value: 'DISCOVERY', label: 'Discovery' },
  { value: 'QUALIFYING', label: 'Qualifying' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
  { value: 'ON_HOLD', label: 'On hold' }
] as const;

export const DEAL_RELATIONSHIP_TYPES = [
  { value: '', label: 'Relationship not set' },
  { value: 'DECISION_MAKER', label: 'Decision maker' },
  { value: 'CHAMPION', label: 'Champion' },
  { value: 'INFLUENCER', label: 'Influencer' },
  { value: 'REFERRER', label: 'Referrer' },
  { value: 'ADVISOR', label: 'Advisor' },
  { value: 'BROKER', label: 'Broker' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'BUYER', label: 'Buyer' },
  { value: 'POTENTIAL_BUYER', label: 'Potential buyer' },
  { value: 'SELLER', label: 'Seller' },
  { value: 'INVESTOR', label: 'Investor' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'CUSTOM', label: 'Custom' }
] as const;

export type DealStatusValue = (typeof DEAL_STATUSES)[number]['value'];
export type DealRelationshipTypeValue = Exclude<(typeof DEAL_RELATIONSHIP_TYPES)[number]['value'], ''>;

const statusLabels = new Map<string, string>(DEAL_STATUSES.map((s) => [s.value, s.label]));
const relationshipLabels = new Map<string, string>(DEAL_RELATIONSHIP_TYPES.map((s) => [s.value, s.label]));

export function dealStatusLabel(status: string | null | undefined) {
  return statusLabels.get(String(status || '')) || 'Discovery';
}

export function dealRelationshipLabel(type: string | null | undefined, fallback?: string | null) {
  if (fallback && fallback.trim()) return fallback.trim();
  return relationshipLabels.get(String(type || '')) || 'connected';
}

export function normaliseDealStatus(value: FormDataEntryValue | null): DealStatusValue {
  const raw = String(value || 'DISCOVERY').trim().toUpperCase();
  return DEAL_STATUSES.some((s) => s.value === raw) ? (raw as DealStatusValue) : 'DISCOVERY';
}

export function normaliseDealRelationshipType(value: FormDataEntryValue | null): DealRelationshipTypeValue | null {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;
  return DEAL_RELATIONSHIP_TYPES.some((s) => s.value === raw) ? (raw as DealRelationshipTypeValue) : 'CUSTOM';
}

export function isClosedDealStatus(status: string | null | undefined) {
  return status === 'WON' || status === 'LOST';
}

export function parseProbability(value: FormDataEntryValue | null): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, parsed));
}

// IT: Commercial amounts are stored as integer cents in PostgreSQL BIGINT columns.
// Browser forms use millions of currency units for fast M&A-style entry (5 => $5.0m).
export type MoneyCents = bigint | number | string | null | undefined;

const CENTS_PER_MILLION = 100_000_000n;
const MAX_COMMERCIAL_VALUE_CENTS = 10_000_000_000_000_000n; // $100 trillion.

function toCentsBigInt(value: MoneyCents): bigint | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
    return BigInt(value);
  }
  const raw = String(value).trim();
  if (!/^-?\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export function commercialValueInputError(value: FormDataEntryValue | string | null): string | null {
  const raw = String(value || '').trim().replace(/,/g, '').replace(/^\$/, '').replace(/[mM]$/, '').trim();
  if (!raw) return null;
  if (!/^\d+(?:\.\d{1,8})?$/.test(raw)) return 'Enter the value in millions, for example 5 or 12.5.';
  const cents = parseMillionsToCents(raw);
  if (cents === null) return 'Enter a value from 0 up to 100,000,000 ($100 trillion).';
  return null;
}

export function parseMillionsToCents(value: FormDataEntryValue | string | null): bigint | null {
  const raw = String(value || '').trim().replace(/,/g, '').replace(/^\$/, '').replace(/[mM]$/, '').trim();
  if (!raw || !/^\d+(?:\.\d{1,8})?$/.test(raw)) return null;

  const [wholeRaw, fractionRaw = ''] = raw.split('.');
  try {
    const wholeMillions = BigInt(wholeRaw || '0');
    const fractionPadded = (fractionRaw + '00000000').slice(0, 8);
    // IT: one million dollars is exactly 100,000,000 cents, so eight decimal places of $m
    // gives cent precision without ever converting the user's input through a JS float.
    const cents = (wholeMillions * CENTS_PER_MILLION) + BigInt(fractionPadded || '0');
    if (cents < 0n || cents > MAX_COMMERCIAL_VALUE_CENTS) return null;
    return cents;
  } catch {
    return null;
  }
}

export function centsToMillionsInputValue(valueCents: MoneyCents) {
  const cents = toCentsBigInt(valueCents);
  if (cents === null) return '';
  const whole = cents / CENTS_PER_MILLION;
  const fraction = (cents % CENTS_PER_MILLION).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

// IT: Compatibility names retained for existing call sites. Stage 7.3.4 changes every
// commercial field using these helpers to an explicitly labelled $m input.
export const parseMoneyToCents = parseMillionsToCents;
export const centsToInputValue = centsToMillionsInputValue;

function currencySymbol(currency: string) {
  switch (String(currency || 'AUD').toUpperCase()) {
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'JPY': return '¥';
    default: return '$';
  }
}

function roundedOneDecimalUnits(cents: bigint, unitDollars: bigint) {
  const unitCents = unitDollars * 100n;
  // IT: calculate tenths with integer rounding so $12.55m displays as $12.6m without floating point.
  const tenths = ((cents * 10n) + (unitCents / 2n)) / unitCents;
  return `${tenths / 10n}.${tenths % 10n}`;
}

export function formatDealValue(valueCents: MoneyCents, currency = 'AUD') {
  const cents = toCentsBigInt(valueCents);
  if (cents === null) return 'No value set';
  const symbol = currencySymbol(currency);
  const dollars = cents / 100n;
  const absDollars = dollars < 0n ? -dollars : dollars;

  if (absDollars >= 1_000_000_000_000n) return `${symbol}${roundedOneDecimalUnits(cents, 1_000_000_000_000n)}t`;
  if (absDollars >= 1_000_000_000n) return `${symbol}${roundedOneDecimalUnits(cents, 1_000_000_000n)}b`;
  if (absDollars >= 1_000_000n) return `${symbol}${roundedOneDecimalUnits(cents, 1_000_000n)}m`;
  if (absDollars >= 1_000n) return `${symbol}${roundedOneDecimalUnits(cents, 1_000n)}k`;

  return `${symbol}${dollars.toLocaleString('en-AU')}`;
}

export function weightedValueCents(valueCents: MoneyCents, probability: number | null | undefined) {
  const cents = toCentsBigInt(valueCents);
  if (cents === null || typeof probability !== 'number' || !Number.isFinite(probability)) return null;
  const pct = BigInt(Math.min(100, Math.max(0, Math.round(probability))));
  return ((cents * pct) + 50n) / 100n;
}

export function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateToInputValue(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function safeDecrypt(payload: string | null | undefined, aad: string, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, aad);
  } catch {
    return fallback;
  }
}

export function defaultProbabilityForStatus(status: string) {
  switch (status) {
    case 'DISCOVERY': return 10;
    case 'QUALIFYING': return 25;
    case 'PROPOSAL': return 50;
    case 'NEGOTIATION': return 75;
    case 'WON': return 100;
    case 'LOST': return 0;
    case 'ON_HOLD': return 20;
    default: return 10;
  }
}
