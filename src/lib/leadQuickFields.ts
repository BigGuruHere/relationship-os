// src/lib/leadQuickFields.ts
// PURPOSE: Define the narrow set of MarketLead fields that may be changed from the lead Details panel.
// SECURITY: Contact identity/details are intentionally excluded so quick edits cannot silently broaden over time.

export const QUICK_MARKET_LEAD_FIELDS = [
  'usualCommunicationMethod',
  'contactAttemptStatus',
  'lastContactedAt',
  'buyerStatus',
  'sellerStatus',
  'confidence',
  'nextAction'
] as const;

export type QuickMarketLeadField = (typeof QUICK_MARKET_LEAD_FIELDS)[number];

export function isQuickMarketLeadField(value: string): value is QuickMarketLeadField {
  return QUICK_MARKET_LEAD_FIELDS.includes(value as QuickMarketLeadField);
}

export function parseQuickLeadConfidence(value: string): number | null {
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
}
