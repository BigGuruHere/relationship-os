// src/lib/leadPriority.ts
// PURPOSE: Shared MarketLead priority stepping logic for the fast calling-queue control.

// IT: Move a MarketLead priority one step while preserving the existing 1-5 scale.
export function stepMarketLeadPriority(current: number, delta: -1 | 1) {
  return Math.min(5, Math.max(1, Math.trunc(current) + delta));
}
