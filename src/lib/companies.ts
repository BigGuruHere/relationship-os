// src/lib/companies.ts
// PURPOSE: Shared company helpers for labels, normalisation, and encrypted display values.
// SECURITY: Decryption helpers are intended for server-side load/actions only.

import { decrypt } from '$lib/crypto';

export const COMPANY_KINDS = [
  { value: 'OPERATING_BUSINESS', label: 'Operating business' },
  { value: 'STRATEGIC_ACQUIRER', label: 'Strategic acquirer' },
  { value: 'FINANCIAL_BUYER', label: 'Financial buyer' },
  { value: 'INVESTOR', label: 'Investor' },
  { value: 'BROKERAGE', label: 'Brokerage' },
  { value: 'ADVISORY_FIRM', label: 'Advisory firm' },
  { value: 'LAW_FIRM', label: 'Law firm' },
  { value: 'ACCOUNTING_FIRM', label: 'Accounting firm' },
  { value: 'FUNDER', label: 'Funder' },
  { value: 'VENDOR_BUSINESS', label: 'Vendor business' },
  { value: 'OTHER', label: 'Other' }
] as const;

export const COMPANY_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'WATCHLIST', label: 'Watchlist' },
  { value: 'DO_NOT_CONTACT', label: 'Do not contact' },
  { value: 'ARCHIVED', label: 'Archived' }
] as const;

export const COMPANY_CONTACT_STATUSES = [
  { value: 'CURRENT', label: 'Current' },
  { value: 'FORMER', label: 'Former' },
  { value: 'ADVISOR', label: 'Advisor' },
  { value: 'UNKNOWN', label: 'Unknown' }
] as const;

export const COMPANY_RELATIONSHIP_TYPES = [
  { value: '', label: 'Relationship not set' },
  { value: 'PARENT_COMPANY', label: 'Parent company' },
  { value: 'SUBSIDIARY', label: 'Subsidiary' },
  { value: 'DIVISION', label: 'Division' },
  { value: 'SISTER_COMPANY', label: 'Sister company' },
  { value: 'INVESTOR_IN', label: 'Investor in' },
  { value: 'OWNED_BY', label: 'Owned by' },
  { value: 'STRATEGIC_PARTNER', label: 'Strategic partner' },
  { value: 'REFERRAL_PARTNER', label: 'Referral partner' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'COMPETITOR', label: 'Competitor' },
  { value: 'ADVISOR_TO', label: 'Advisor to' },
  { value: 'BROKER_FOR', label: 'Broker for' },
  { value: 'RELATED_ENTITY', label: 'Related entity' },
  { value: 'CUSTOM', label: 'Custom' }
] as const;

type Opt = { readonly value: string; readonly label: string };

function labelFrom(options: readonly Opt[], value: string | null | undefined, fallback = '') {
  return options.find((o) => o.value === String(value || ''))?.label || fallback || String(value || '');
}

function normaliseFrom<T extends readonly Opt[]>(options: T, value: FormDataEntryValue | null, fallback: T[number]['value']) {
  const raw = String(value || '').trim().toUpperCase();
  return (options.some((o) => o.value === raw) ? raw : fallback) as T[number]['value'];
}

export const companyKindLabel = (v: string | null | undefined) => labelFrom(COMPANY_KINDS, v, 'Operating business');
export const companyStatusLabel = (v: string | null | undefined) => labelFrom(COMPANY_STATUSES, v, 'Active');
export const companyContactStatusLabel = (v: string | null | undefined) => labelFrom(COMPANY_CONTACT_STATUSES, v, 'Current');
export const companyRelationshipTypeLabel = (v: string | null | undefined, fallback?: string | null) => {
  if (fallback && fallback.trim()) return fallback.trim();
  return labelFrom(COMPANY_RELATIONSHIP_TYPES, v, 'Related');
};

export const normaliseCompanyKind = (v: FormDataEntryValue | null) => normaliseFrom(COMPANY_KINDS, v, 'OPERATING_BUSINESS');
export const normaliseCompanyStatus = (v: FormDataEntryValue | null) => normaliseFrom(COMPANY_STATUSES, v, 'ACTIVE');
export const normaliseCompanyContactStatus = (v: FormDataEntryValue | null) => normaliseFrom(COMPANY_CONTACT_STATUSES, v, 'CURRENT');
export const normaliseCompanyRelationshipType = (v: FormDataEntryValue | null) => {
  const raw = String(v || '').trim().toUpperCase();
  if (!raw) return null;
  return COMPANY_RELATIONSHIP_TYPES.some((o) => o.value === raw) ? raw : 'CUSTOM';
};

export function safeDecryptCompany(payload: string | null | undefined, aad: string, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, aad);
  } catch {
    return fallback;
  }
}

export function companyDisplay(row: { nameEnc: string | null }) {
  return safeDecryptCompany(row.nameEnc, 'company.name', 'Untitled company');
}
