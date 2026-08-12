// src/lib/tasks.ts
// PURPOSE: Shared helpers for unified tasks, projects, and deal-contact commercial state.
// SECURITY: Decrypt helpers must only be called from server load/actions.

import { decrypt } from '$lib/crypto';

export const DEAL_CONTACT_STAGES = [
  { value: 'NOT_CONTACTED', label: 'Not contacted' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'TEASER_SENT', label: 'Teaser sent' },
  { value: 'NDA_SENT', label: 'NDA sent' },
  { value: 'NDA_SIGNED', label: 'NDA signed' },
  { value: 'IM_SENT', label: 'IM sent' },
  { value: 'MEETING_BOOKED', label: 'Meeting booked' },
  { value: 'REVIEWING', label: 'Reviewing' },
  { value: 'OFFER_EXPECTED', label: 'Offer expected' },
  { value: 'OFFER_MADE', label: 'Offer made' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'NOT_SUITABLE', label: 'Not suitable' },
  { value: 'DORMANT', label: 'Dormant' }
] as const;

export const DEAL_CONTACT_INTERESTS = [
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'COLD', label: 'Cold' },
  { value: 'WARM', label: 'Warm' },
  { value: 'HOT', label: 'Hot' },
  { value: 'STRONG_FIT', label: 'Strong fit' },
  { value: 'NOT_A_FIT', label: 'Not a fit' }
] as const;

export const DEAL_CONFIDENTIALITY_STAGES = [
  { value: 'NONE', label: 'None' },
  { value: 'BLIND_TEASER_SENT', label: 'Blind teaser sent' },
  { value: 'NDA_SENT', label: 'NDA sent' },
  { value: 'NDA_SIGNED', label: 'NDA signed' },
  { value: 'IM_SENT', label: 'IM sent' },
  { value: 'DATA_ROOM_ACCESS', label: 'Data room access' },
  { value: 'VENDOR_APPROVED', label: 'Vendor approved' }
] as const;

export const TASK_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'SNOOZED', label: 'Snoozed' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' }
] as const;

export const TASK_URGENCIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' }
] as const;

export const TASK_IMPORTANCES = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' }
] as const;

export const TASK_TYPES = [
  { value: 'FOLLOW_UP', label: 'Follow up' },
  { value: 'CALL', label: 'Call' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SEND_DOCUMENT', label: 'Send document' },
  { value: 'BOOK_MEETING', label: 'Book meeting' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'PREPARE', label: 'Prepare' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'INTRODUCE', label: 'Introduce' },
  { value: 'DECISION', label: 'Decision' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'PERSONAL_TODO', label: 'Personal todo' },
  { value: 'DEAL_STEP', label: 'Deal step' },
  { value: 'CUSTOM', label: 'Custom' }
] as const;

export const PROJECT_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'COMPLETED', label: 'Completed' },
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

export const dealContactStageLabel = (v: string | null | undefined) => labelFrom(DEAL_CONTACT_STAGES, v, 'Not contacted');
export const dealContactInterestLabel = (v: string | null | undefined) => labelFrom(DEAL_CONTACT_INTERESTS, v, 'Unknown');
export const dealConfidentialityLabel = (v: string | null | undefined) => labelFrom(DEAL_CONFIDENTIALITY_STAGES, v, 'None');
export const taskStatusLabel = (v: string | null | undefined) => labelFrom(TASK_STATUSES, v, 'Open');
export const taskUrgencyLabel = (v: string | null | undefined) => labelFrom(TASK_URGENCIES, v, 'Normal');
export const taskImportanceLabel = (v: string | null | undefined) => labelFrom(TASK_IMPORTANCES, v, 'Normal');
export const taskTypeLabel = (v: string | null | undefined) => labelFrom(TASK_TYPES, v, 'Follow up');
export const projectStatusLabel = (v: string | null | undefined) => labelFrom(PROJECT_STATUSES, v, 'Active');

export const normaliseDealContactStage = (v: FormDataEntryValue | null) => normaliseFrom(DEAL_CONTACT_STAGES, v, 'NOT_CONTACTED');
export const normaliseDealContactInterest = (v: FormDataEntryValue | null) => normaliseFrom(DEAL_CONTACT_INTERESTS, v, 'UNKNOWN');
export const normaliseDealConfidentiality = (v: FormDataEntryValue | null) => normaliseFrom(DEAL_CONFIDENTIALITY_STAGES, v, 'NONE');
export const normaliseTaskStatus = (v: FormDataEntryValue | null) => normaliseFrom(TASK_STATUSES, v, 'OPEN');
export const normaliseTaskUrgency = (v: FormDataEntryValue | null) => normaliseFrom(TASK_URGENCIES, v, 'NORMAL');
export const normaliseTaskImportance = (v: FormDataEntryValue | null) => normaliseFrom(TASK_IMPORTANCES, v, 'NORMAL');
export const normaliseTaskType = (v: FormDataEntryValue | null) => normaliseFrom(TASK_TYPES, v, 'FOLLOW_UP');
export const normaliseProjectStatus = (v: FormDataEntryValue | null) => normaliseFrom(PROJECT_STATUSES, v, 'ACTIVE');

export function parseDateTime(value: FormDataEntryValue | null): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateTimeToInputValue(value: Date | string | null | undefined) {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

export function taskIsOpen(status: string | null | undefined) {
  return status !== 'DONE' && status !== 'CANCELLED';
}

export function safeDecryptTask(payload: string | null | undefined, aad: string, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, aad);
  } catch {
    return fallback;
  }
}
