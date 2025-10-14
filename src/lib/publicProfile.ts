// PURPOSE: one place to turn a Profile row into public display pieces and a vCard URL.
// ADD OR REMOVE FIELDS HERE once, and all pages reflect the change.
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
  };
  
  function nonEmpty(s: string | null | undefined): s is string {
    return !!s && s.trim().length > 0;
  }
  
  // Build the vCard download URL from a profile and a public link
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
  
  // Header block data - keeps view templates clean
  export function headerFrom(profile: PublicProfile) {
    return {
      name: nonEmpty(profile.displayName) ? profile.displayName!.trim() : 'Public profile',
      headline: nonEmpty(profile.headline) ? profile.headline!.trim() : null,
      company: nonEmpty(profile.company) ? profile.company!.trim() : null,
      title: nonEmpty(profile.title) ? profile.title!.trim() : null,
      avatarUrl: nonEmpty(profile.avatarUrl) ? profile.avatarUrl!.trim() : null
    };
  }
  
  // Rows for the contact info section - iterate these in the template
  export function publicRows(profile: PublicProfile) {
    const rows: Array<{ label: string; value: string; href?: string }> = [];
  
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
  
    return rows;
  }
  
  // Useful in controllers to decide if a profile is still blank
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
  