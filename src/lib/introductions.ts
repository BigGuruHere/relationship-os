// src/lib/introductions.ts
// PURPOSE: Browser-safe labels and normalisers for Stage 8.2 Introduction/Outcome capture.

export const INTRODUCTION_STATUSES = [
  { value: 'PLANNED', label: 'Planned' },
  { value: 'PROPOSED', label: 'Proposed' },
  { value: 'INTRODUCED', label: 'Introduced' },
  { value: 'CONNECTED', label: 'Connected' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'CLOSED', label: 'Closed' }
] as const;

export const OUTCOME_STATUSES = [
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'NO_RESPONSE', label: 'No response' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'CONNECTED', label: 'Connected / spoke' },
  { value: 'CONTINUING', label: 'Continuing' },
  { value: 'SUCCESSFUL', label: 'Successful' },
  { value: 'ENDED', label: 'Ended' }
] as const;

export const OUTCOME_COMMERCIALITY = [
  { value: 'UNKNOWN', label: 'Not known' },
  { value: 'NON_COMMERCIAL', label: 'Non-commercial' },
  { value: 'COMMERCIAL', label: 'Commercial' }
] as const;

export const YES_NO_UNKNOWN = [
  { value: '', label: 'Unknown' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' }
] as const;

type Opt = { readonly value: string; readonly label: string };

function labelFrom(options: readonly Opt[], value: string | null | undefined, fallback = '') {
  return options.find((o) => o.value === String(value || ''))?.label || fallback || String(value || '');
}

function normaliseFrom<T extends readonly Opt[]>(options: T, value: FormDataEntryValue | string | null | undefined, fallback: T[number]['value']) {
  const raw = String(value || '').trim().toUpperCase();
  return (options.some((o) => o.value === raw) ? raw : fallback) as T[number]['value'];
}

export const introductionStatusLabel = (value: string | null | undefined) => labelFrom(INTRODUCTION_STATUSES, value, 'Introduced');
export const outcomeStatusLabel = (value: string | null | undefined) => labelFrom(OUTCOME_STATUSES, value, 'Unknown');
export const outcomeCommercialityLabel = (value: string | null | undefined) => labelFrom(OUTCOME_COMMERCIALITY, value, 'Not known');

export const normaliseIntroductionStatus = (value: FormDataEntryValue | string | null | undefined) => normaliseFrom(INTRODUCTION_STATUSES, value, 'INTRODUCED');
export const normaliseOutcomeStatus = (value: FormDataEntryValue | string | null | undefined) => normaliseFrom(OUTCOME_STATUSES, value, 'UNKNOWN');
export const normaliseOutcomeCommerciality = (value: FormDataEntryValue | string | null | undefined) => normaliseFrom(OUTCOME_COMMERCIALITY, value, 'UNKNOWN');

export function parseOptionalBoolean(value: FormDataEntryValue | string | null | undefined): boolean | null {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'yes' || raw === 'true' || raw === '1') return true;
  if (raw === 'no' || raw === 'false' || raw === '0') return false;
  return null;
}
