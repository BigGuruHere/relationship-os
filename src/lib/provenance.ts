// src/lib/provenance.ts
// PURPOSE: Browser-safe labels and normalisers for Stage 8.2 provenance metadata.
// NOTE: Authority answers where a statement/event gets its standing from. Confidence remains a separate axis.

export const KNOWLEDGE_AUTHORITIES = [
  { value: 'LEGACY_UNSPECIFIED', label: 'Legacy / unspecified' },
  { value: 'SELF_DECLARED', label: 'Self-declared' },
  { value: 'THIRD_PARTY_REPORTED', label: 'Third-party reported' },
  { value: 'WORKSPACE_RECORDED', label: 'Workspace recorded' },
  { value: 'PUBLIC_SOURCE', label: 'Public source' },
  { value: 'INFERRED', label: 'Inferred' },
  { value: 'SYSTEM_DERIVED', label: 'System derived' }
] as const;

export const KNOWLEDGE_SOURCE_TYPES = [
  { value: 'MANUAL', label: 'Manual entry' },
  { value: 'INTERACTION', label: 'Interaction / conversation' },
  { value: 'PUBLIC_RESEARCH', label: 'Public research' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'SYSTEM', label: 'System' },
  { value: 'OTHER', label: 'Other' }
] as const;

type Opt = { readonly value: string; readonly label: string };

function labelFrom(options: readonly Opt[], value: string | null | undefined, fallback = '') {
  return options.find((o) => o.value === String(value || ''))?.label || fallback || String(value || '');
}

function normaliseFrom<T extends readonly Opt[]>(options: T, value: FormDataEntryValue | string | null | undefined, fallback: T[number]['value']) {
  const raw = String(value || '').trim().toUpperCase();
  return (options.some((o) => o.value === raw) ? raw : fallback) as T[number]['value'];
}

export const knowledgeAuthorityLabel = (value: string | null | undefined) =>
  labelFrom(KNOWLEDGE_AUTHORITIES, value, 'Legacy / unspecified');

export const knowledgeSourceTypeLabel = (value: string | null | undefined) =>
  labelFrom(KNOWLEDGE_SOURCE_TYPES, value, 'Manual entry');

export const normaliseKnowledgeAuthority = (
  value: FormDataEntryValue | string | null | undefined,
  fallback: (typeof KNOWLEDGE_AUTHORITIES)[number]['value'] = 'THIRD_PARTY_REPORTED'
) => normaliseFrom(KNOWLEDGE_AUTHORITIES, value, fallback);

export const normaliseKnowledgeSourceType = (
  value: FormDataEntryValue | string | null | undefined,
  fallback: (typeof KNOWLEDGE_SOURCE_TYPES)[number]['value'] = 'MANUAL'
) => normaliseFrom(KNOWLEDGE_SOURCE_TYPES, value, fallback);
