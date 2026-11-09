// src/lib/publicProfile.ts
// PURPOSE: single source of truth to render a Profile and build a vCard URL.
// FLEX: reads and writes extra public fields from profile.publicMeta JSON.
// SECURITY: client only reads public strings - server handles any encryption.

// -----------------------------
// Types and small utilities
// -----------------------------

export type PublicProfile = {
  id?: string | null;
  displayName?: string | null;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  company?: string | null;
  title?: string | null;
  websiteUrl?: string | null;
  emailPublic?: string | null;
  phonePublic?: string | null;
  publicMeta?: any | null; // flexible JSON bag for extra public fields
};

function nonEmpty(s: string | null | undefined): s is string {
  return !!s && s.trim().length > 0;
}

// Known extra keys you can support without DB changes - add to this list over time
export const EXTRA_KEYS: Array<{ key: string; label: string }> = [
  { key: 'linkedin',  label: 'LinkedIn' },
  { key: 'calendar',  label: 'Calendar' },
  { key: 'twitter',   label: 'Twitter' },
  { key: 'github',    label: 'GitHub' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube',   label: 'YouTube' },
  { key: 'x',         label: 'X' }
];

// -----------------------------
// vCard builder and header view
// -----------------------------

// Share only browser-safe public web links, including platform-specific handles.
export function publicContactUrl(value: string): string | null {
  if (!value || value.length > 1024 || /[\s\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

const socialHandleHosts: Record<string, string> = {
  twitter: 'x.com', x: 'x.com', instagram: 'instagram.com', github: 'github.com', youtube: 'youtube.com'
};

// Build the vCard URL from a profile and its public link.
export function buildVcardUrl(profile: PublicProfile, publicLink: string): string {
  const params = new URLSearchParams();
  params.set('name', nonEmpty(profile.displayName) ? profile.displayName!.trim() : 'Contact');
  if (nonEmpty(profile.company)) params.set('org', profile.company!.trim());
  if (nonEmpty(profile.title)) params.set('title', profile.title!.trim());
  if (nonEmpty(profile.emailPublic)) params.set('email', profile.emailPublic!.trim());
  if (nonEmpty(profile.phonePublic)) params.set('phone', profile.phonePublic!.trim());
  params.set('link', publicLink);
  const links = new Set<string>();
  for (const row of publicRows(profile)) {
    if (!row.href) continue;
    const raw = row.href.trim();
    const link = publicContactUrl(row.label === 'Website' && /^[a-z0-9-]+\.[a-z0-9]/i.test(raw)
      ? 'https://' + raw : raw);
    if (link) links.add(link);
  }
  for (const [key, host] of Object.entries(socialHandleHosts)) {
    const raw = profile.publicMeta?.[key];
    if (typeof raw !== 'string') continue;
    const handle = raw.trim();
    const username = handle.replace(/^@/, '');
    if (/^@[a-z0-9_][a-z0-9_.-]{0,99}$/i.test(handle) ||
        ((key === 'x' || key === 'twitter') && /^[a-z0-9_]{1,15}$/i.test(handle)))
      links.add('https://' + host + '/' + (key === 'youtube' ? '@' + username : username));
  }
  for (const link of [...links].slice(0, 10)) params.append('url', link);
  return `/api/vcard?${params.toString()}`;
}

// Header block data for the public page
export function headerFrom(profile: PublicProfile) {
  return {
    name: nonEmpty(profile.displayName) ? profile.displayName!.trim() : 'Public profile',
    headline: nonEmpty(profile.headline) ? profile.headline!.trim() : null,
    company: nonEmpty(profile.company) ? profile.company!.trim() : null,
    title: nonEmpty(profile.title) ? profile.title!.trim() : null,
    avatarUrl: nonEmpty(profile.avatarUrl) ? profile.avatarUrl!.trim() : null
  };
}

// -----------------------------------------
// LinkedIn helpers for consistent handling
// -----------------------------------------

// PURPOSE: normalize a LinkedIn URL to a stable canonical host and path
// SECURITY: drops query strings and fragments
export function normalizeLinkedInUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    if (!url.hostname.toLowerCase().includes('linkedin.com')) return '';
    const baseHost = 'www.linkedin.com';
    const path = url.pathname.replace(/\/+$/, '');
    if (!path || path === '/') return '';
    return `https://${baseHost}${path}`.toLowerCase();
  } catch {
    return '';
  }
}

// PURPOSE: extract a LinkedIn URL from a profile's publicMeta or websiteUrl
// FLEX: assumes EXTRA_KEYS contains key 'linkedin'
export function pickLinkedInUrlFromProfile(profile: PublicProfile): string {
  const m = profile.publicMeta || {};
  const direct = typeof m.linkedin === 'string' ? m.linkedin.trim() : '';

  if (direct && direct.toLowerCase().includes('linkedin.com')) {
    return normalizeLinkedInUrl(direct);
  }

  const site = typeof profile.websiteUrl === 'string' ? profile.websiteUrl.trim() : '';
  if (site && site.toLowerCase().includes('linkedin.com')) {
    return normalizeLinkedInUrl(site);
  }

  return '';
}

// ---------------------------------------------------
// Public rows - core fields plus extras from metadata
// ---------------------------------------------------

export function publicRows(profile: Pick<PublicProfile, 'websiteUrl' | 'emailPublic' | 'phonePublic' | 'publicMeta'>) {
  const rows: Array<{ label: string; value: string; href?: string }> = [];

  // Core fields first
  if (nonEmpty(profile.emailPublic)) {
    const val = profile.emailPublic!.trim();
    rows.push({ label: 'Email', value: val, href: `mailto:${val}` });
  }
  if (nonEmpty(profile.phonePublic)) {
    const val = profile.phonePublic!.trim();
    rows.push({ label: 'Phone', value: val, href: `tel:${val}` });
  }
  if (nonEmpty(profile.websiteUrl)) {
    const val = profile.websiteUrl!.trim();
    rows.push({ label: 'Website', value: val, href: val });
  }

  // Extras from publicMeta by known keys
  const m = profile.publicMeta || {};
  for (const spec of EXTRA_KEYS) {
    const raw = typeof m[spec.key] === 'string' ? String(m[spec.key]) : '';
    if (nonEmpty(raw)) {
      const val = raw.trim();

      // IT: ensure href is clickable - add https if it looks like a URL without scheme
      const hasScheme = /^https?:\/\//i.test(val);
      let href: string | undefined =
        hasScheme ? val : (val.includes('.') ? `https://${val}` : undefined);

      // IT: LinkedIn rows get normalized to canonical form when possible
      if (spec.key === 'linkedin') {
        const normalized = normalizeLinkedInUrl(href || val);
        if (normalized) href = normalized;
      }

      rows.push({ label: spec.label, value: val, href });
    }
  }

  // Optional free form extras array - { label, value, href? }
  if (Array.isArray(m.extras)) {
    for (const item of m.extras) {
      const lbl = typeof item?.label === 'string' ? item.label.trim() : '';
      const val = typeof item?.value === 'string' ? item.value.trim() : '';
      const href = typeof item?.href === 'string' ? item.href : undefined;
      if (nonEmpty(lbl) && nonEmpty(val)) rows.push({ label: lbl, value: val, href });
    }
  }

  return rows;
}

// -------------------------------------------
// Merge extras back into profile.publicMeta
// -------------------------------------------

export function mergeExtras(publicMeta: any, extras: Record<string, string>) {
  const next = { ...(publicMeta || {}) };
  for (const spec of EXTRA_KEYS) {
    const v = (extras[spec.key] || '').trim();
    if (v) next[spec.key] = v;
    else delete next[spec.key];
  }
  return next;
}

// -------------------------------------------------
// Blank profile check for first time user guidance
// -------------------------------------------------

export function isProfileBlank(profile: PublicProfile) {
  return !nonEmpty(profile.displayName)
    && !nonEmpty(profile.headline)
    && !nonEmpty(profile.company)
    && !nonEmpty(profile.title)
    && !nonEmpty(profile.websiteUrl)
    && !nonEmpty(profile.emailPublic)
    && !nonEmpty(profile.phonePublic)
    && !nonEmpty(profile.avatarUrl)
    && !nonEmpty(profile.bio);
}
