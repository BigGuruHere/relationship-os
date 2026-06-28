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

export function parseMoneyToCents(value: FormDataEntryValue | null): number | null {
  const raw = String(value || '').trim().replace(/,/g, '');
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function centsToInputValue(valueCents: number | null | undefined) {
  if (typeof valueCents !== 'number') return '';
  return (valueCents / 100).toFixed(2);
}

export function formatDealValue(valueCents: number | null | undefined, currency = 'AUD') {
  if (typeof valueCents !== 'number') return 'No value set';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency || 'AUD',
    maximumFractionDigits: 0
  }).format(valueCents / 100);
}

export function weightedValueCents(valueCents: number | null | undefined, probability: number | null | undefined) {
  if (typeof valueCents !== 'number' || typeof probability !== 'number') return null;
  return Math.round((valueCents * probability) / 100);
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
