// PURPOSE: Preserve the exact working Leads list when opening and returning from a lead.
// SECURITY: Return targets are limited to the Leads list route so query-string input cannot become an open redirect.

export function safeLeadListReturnTo(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '/leads';
  if (!/^\/leads(?:\?.*)?$/.test(raw)) return '/leads';
  return raw;
}

export function buildLeadDetailHref(leadId: string, listHref: string): string {
  const safeListHref = safeLeadListReturnTo(listHref);
  return `/leads/${encodeURIComponent(leadId)}?returnTo=${encodeURIComponent(safeListHref)}`;
}

export function buildLeadDetailReturnUrl(leadId: string, returnTo: unknown): string {
  const safeListHref = safeLeadListReturnTo(returnTo);
  return `/leads/${encodeURIComponent(leadId)}?returnTo=${encodeURIComponent(safeListHref)}`;
}

export function buildLeadListReturnHref(returnTo: unknown): string {
  return `${safeLeadListReturnTo(returnTo)}#lead-list`;
}
