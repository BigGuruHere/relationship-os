// PURPOSE: Restrict onboarding redirects to a Network invite route only.
// SECURITY: Never accept arbitrary redirect URLs from public query parameters.
export function safeNetworkJoinReturn(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 260 || !raw.startsWith('/network/join/')) return null;
  if (raw.includes('?') || raw.includes('#') || raw.includes('\\') || raw.includes('//')) return null;
  const slug = raw.slice('/network/join/'.length);
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,180}$/.test(slug) ? raw : null;
}
