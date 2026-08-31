// src/lib/interactions.ts
// PURPOSE: Browser-safe labels for channel-neutral Stage 8.4 interaction ingestion sources.

export const INTERACTION_SOURCE_TYPES = [
  { value: 'WORKSPACE', label: 'Relish Workspace' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'EMAIL_CONNECTOR', label: 'Email connector' },
  { value: 'CALENDAR_CONNECTOR', label: 'Calendar connector' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'API', label: 'API' },
  { value: 'SYSTEM', label: 'System' },
  { value: 'OTHER', label: 'Other' }
] as const;

export function interactionSourceTypeLabel(value: string | null | undefined) {
  return INTERACTION_SOURCE_TYPES.find((o) => o.value === String(value || ''))?.label || String(value || 'Other');
}
