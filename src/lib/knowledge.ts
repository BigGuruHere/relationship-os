// src/lib/knowledge.ts
// PURPOSE: Browser-safe Stage 8.4 knowledge claim labels and normalisers.

export const KNOWLEDGE_CLAIM_KINDS = [
  { value: 'FACT', label: 'Fact' },
  { value: 'OBJECTIVE', label: 'Objective' },
  { value: 'WANT', label: 'Want' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'PREFERENCE', label: 'Preference' },
  { value: 'CONSTRAINT', label: 'Constraint' },
  { value: 'RELATIONSHIP_STATE', label: 'Relationship state' },
  { value: 'OTHER', label: 'Other' }
] as const;

export const KNOWLEDGE_CLAIM_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUPERSEDED', label: 'Superseded' },
  { value: 'REJECTED', label: 'Rejected' }
] as const;

export const KNOWLEDGE_CONFIDENCES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' }
] as const;

type Opt = { readonly value: string; readonly label: string };

function labelFrom(options: readonly Opt[], value: string | null | undefined, fallback = '') {
  return options.find((o) => o.value === String(value || ''))?.label || fallback || String(value || '');
}

function normaliseFrom<T extends readonly Opt[]>(options: T, value: FormDataEntryValue | string | null | undefined, fallback: T[number]['value']) {
  const raw = String(value || '').trim().toUpperCase();
  return (options.some((o) => o.value === raw) ? raw : fallback) as T[number]['value'];
}

export const knowledgeClaimKindLabel = (value: string | null | undefined) => labelFrom(KNOWLEDGE_CLAIM_KINDS, value, 'Other');
export const knowledgeClaimStatusLabel = (value: string | null | undefined) => labelFrom(KNOWLEDGE_CLAIM_STATUSES, value, 'Active');
export const knowledgeConfidenceLabel = (value: string | null | undefined) => labelFrom(KNOWLEDGE_CONFIDENCES, value, 'Medium');

export const normaliseKnowledgeClaimKind = (value: FormDataEntryValue | string | null | undefined) =>
  normaliseFrom(KNOWLEDGE_CLAIM_KINDS, value, 'FACT');
export const normaliseKnowledgeClaimStatus = (value: FormDataEntryValue | string | null | undefined) =>
  normaliseFrom(KNOWLEDGE_CLAIM_STATUSES, value, 'ACTIVE');
export const normaliseKnowledgeConfidence = (value: FormDataEntryValue | string | null | undefined) =>
  normaliseFrom(KNOWLEDGE_CONFIDENCES, value, 'MEDIUM');
