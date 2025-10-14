// PURPOSE: single source of truth to render a Profile and build a vCard URL.
// FLEX: reads and writes extra public fields from profile.publicMeta JSON.
// All IT code is commented and uses hyphens only.

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
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'twitter',  label: 'Twitter' },
    { key: 'github',   label: 'GitHub' },
    { key: 'instagram',label: 'Instagram' },
    { key: 'youtube',  label: 'YouTube' },
    { key: 'x',        label: 'X' }
  ];
  
  // Build the vCard URL from a profile and a public link - core fields only
  export function buildVcardUrl(profile: PublicProfile, publicLink: string): string {
    const params = new URLSearchParams();
    params.set('name', nonEmpty(profile.displayName) ? profile.displayName!.trim() : 'Contact');
    if (nonEmpty(profile.company)) params.set('org', profile.company!.trim());
    if (nonEmpty(profile.title)) params.set('title', profile.title!.trim());
    if (nonEmpty(profile.emailPublic)) params.set('email', profile.emailPublic!.trim());
    if (nonEmpty(profile.phonePublic)) params.set('phone', profile.phonePublic!.trim());
    params.set('link', publicLink);
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
  
  // Rows for the contact info section - includes core fields plus extras from publicMeta
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
        rows.push({ label: spec.label, value: val, href: val.startsWith('http') ? val : undefined });
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
  
  // Merge extras into an existing publicMeta object - used on save
  export function mergeExtras(publicMeta: any, extras: Record<string, string>) {
    const next = { ...(publicMeta || {}) };
    for (const spec of EXTRA_KEYS) {
      const v = (extras[spec.key] || '').trim();
      if (v) next[spec.key] = v;
      else delete next[spec.key];
    }
    return next;
  }
  
  // Is the profile effectively blank for first time guidance
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
  