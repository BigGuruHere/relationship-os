// src/lib/share.ts
// PURPOSE: build stable public URLs for profiles so recipients always see updates
// NOTES: prefer profile.slug - fall back to user.publicSlug or id if needed

export function profileShareUrl(origin: string, args: { profileSlug?: string; userSlug?: string; userId?: string }) {
    // IT: the profile is the source of truth for public views
    if (args.profileSlug) return `${origin}/u/${encodeURIComponent(args.profileSlug)}`;
    // IT: legacy fallback paths - still resolve to the current default profile on load
    if (args.userSlug) return `${origin}/u/${encodeURIComponent(args.userSlug)}`;
    if (args.userId) return `${origin}/u/${encodeURIComponent(args.userId)}`;
    return `${origin}/u`;
  }
  