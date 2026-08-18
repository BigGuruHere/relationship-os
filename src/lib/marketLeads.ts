// src/lib/marketLeads.ts
// PURPOSE: Shared Stage 6 lead labels, parsing helpers, and safe display helpers.
// SECURITY: Decryption helpers are intended for server-side load/actions only.

import { decrypt } from '$lib/crypto';

export const COMMUNICATION_METHODS = [
  { value: '', label: 'Not set' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'IN_PERSON', label: 'In person' },
  { value: 'OTHER', label: 'Other' },
  { value: 'UNKNOWN', label: 'Unknown' }
] as const;

export const MARKET_LEAD_TYPES = [
  { value: 'BUYER', label: 'Buyer' },
  { value: 'SELLER', label: 'Seller' },
  { value: 'POTENTIAL_BUYER', label: 'Potential buyer' },
  { value: 'POTENTIAL_SELLER', label: 'Potential seller' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'CONTACT', label: 'Contact' },
  { value: 'MANDATE', label: 'Mandate' },
  { value: 'ASSET', label: 'Asset' },
  { value: 'REFERRER', label: 'Referrer' },
  { value: 'OTHER', label: 'Other' }
] as const;

export const MARKET_LEAD_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'NOT_CONTACTED', label: 'Not contacted' },
  { value: 'RESEARCHING', label: 'Researching' },
  { value: 'TRIED_NO_CONTACT', label: 'Tried - no contact' },
  { value: 'LEFT_VOICEMAIL', label: 'Left voicemail' },
  { value: 'FOLLOW_UP_NEEDED', label: 'Follow-up needed' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'RESPONDED', label: 'Responded' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'NURTURE', label: 'Nurture' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'NOT_RELEVANT', label: 'Not relevant' },
  { value: 'ARCHIVED', label: 'Archived' }
] as const;

export const MARKET_LEAD_SOURCES = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'OUTREACH', label: 'Outreach' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'IMPORTED', label: 'Imported' },
  { value: 'AI', label: 'AI' },
  { value: 'OTHER', label: 'Other' }
] as const;


export const NOTE_CHANNELS = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'voice note', label: 'Voice note' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'Other' }
] as const;

type Opt = { readonly value: string; readonly label: string };

function labelFrom(options: readonly Opt[], value: string | null | undefined, fallback = '') {
  return options.find((o) => o.value === String(value || ''))?.label || fallback || String(value || '');
}

function normaliseFrom<T extends readonly Opt[]>(options: T, value: FormDataEntryValue | null, fallback: T[number]['value']) {
  const raw = String(value || '').trim().toUpperCase();
  return (options.some((o) => o.value === raw) ? raw : fallback) as T[number]['value'];
}

export const communicationMethodLabel = (v: string | null | undefined) => labelFrom(COMMUNICATION_METHODS, v, 'Not set');
export const marketLeadTypeLabel = (v: string | null | undefined) => labelFrom(MARKET_LEAD_TYPES, v, 'Other');
export const marketLeadStatusLabel = (v: string | null | undefined) => labelFrom(MARKET_LEAD_STATUSES, v, 'New');
export const marketLeadSourceLabel = (v: string | null | undefined) => labelFrom(MARKET_LEAD_SOURCES, v, 'Manual');
export const noteChannelLabel = (v: string | null | undefined) => labelFrom(NOTE_CHANNELS, v, String(v || 'Note'));
export const normaliseNoteChannel = (v: FormDataEntryValue | null) => {
  const raw = String(v || '').trim().toLowerCase();
  if (!raw) return 'note';
  return NOTE_CHANNELS.some((o) => o.value === raw) ? raw : 'other';
};

export const normaliseCommunicationMethod = (v: FormDataEntryValue | null) => {
  const raw = String(v || '').trim().toUpperCase();
  if (!raw) return null;
  return COMMUNICATION_METHODS.some((o) => o.value === raw) ? raw : 'OTHER';
};
export const normaliseMarketLeadType = (v: FormDataEntryValue | null) => normaliseFrom(MARKET_LEAD_TYPES, v, 'OTHER');
export const normaliseMarketLeadStatus = (v: FormDataEntryValue | null) => normaliseFrom(MARKET_LEAD_STATUSES, v, 'NEW');
export const normaliseMarketLeadSource = (v: FormDataEntryValue | null) => normaliseFrom(MARKET_LEAD_SOURCES, v, 'MANUAL');

export function clampInt(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function safeDecryptLead(payload: string | null | undefined, aad: string, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, aad);
  } catch {
    return fallback;
  }
}

export function dateToDatetimeLocal(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

export function parseDateTime(value: FormDataEntryValue | null): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
