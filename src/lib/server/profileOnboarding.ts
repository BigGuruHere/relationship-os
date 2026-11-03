// IT: A short-lived encrypted draft carries voluntarily entered details through signup.
// SECURITY: This is form convenience only, never identity evidence or Contact linking authority.
import type { Cookies } from '@sveltejs/kit';
import { encrypt, decrypt } from '../crypto';

export const PROFILE_ONBOARDING_RETURN = '/settings/profile?onboarding=1';
export const PROFILE_DRAFT_COOKIE = 'relish_profile_draft';
const TTL = 30 * 60 * 1000;
const PURPOSE = 'profile.onboarding.draft.v1';
export type ProfileDraft = { name: string; email: string; phone: string };

// IT: Bound the cookie size and accept plain strings only. All fields remain unverified.
export function profileDraft(input: Partial<ProfileDraft>): ProfileDraft {
  const field = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  return { name: field(input.name, 200), email: field(input.email, 254), phone: field(input.phone, 40) };
}

export function encodeProfileDraft(input: ProfileDraft, now = Date.now()): string {
  return encrypt(JSON.stringify({ ...profileDraft(input), issuedAt: now }), PURPOSE);
}

export function decodeProfileDraft(value: string | undefined, now = Date.now()): ProfileDraft | null {
  if (!value || value.length > 4000) return null;
  try {
    // SECURITY: Reject noncanonical or extra segments before the shared base64 decoder.
    const segments = value.split(':');
    if (segments.length !== 3 || segments.some(part => Buffer.from(part, 'base64').toString('base64') !== part)) return null;
    const draft = JSON.parse(decrypt(value, PURPOSE));
    if (!Number.isFinite(draft.issuedAt) || draft.issuedAt > now || now - draft.issuedAt >= TTL) return null;
    return profileDraft(draft);
  } catch { return null; } // Expired, malformed or tampered drafts never block signup.
}

export function readProfileDraft(cookies: Cookies): ProfileDraft | null {
  return decodeProfileDraft(cookies.get(PROFILE_DRAFT_COOKIE));
}

export function saveProfileDraft(cookies: Cookies, url: URL, input: ProfileDraft) {
  // IT: Root scope survives the Google callback; HttpOnly keeps draft PII out of browser scripts.
  cookies.set(PROFILE_DRAFT_COOKIE, encodeProfileDraft(input), {
    path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: TTL / 1000
  });
}

// IT: Remember successful shares for this browser only, without storing contact details.
// SECURITY: This is a navigation hint, never identity, access or reciprocal-connection authority.
export const CONTACT_SHARED_COOKIE = 'relish_contact_shared';
const SHARED_TTL = 30 * 24 * 60 * 60 * 1000;
const SHARED_PURPOSE = 'profile.contact-shared.v1';
type SharedProfile = { profileId: string; sharedAt: number };

function sharedProfiles(cookies: Cookies, now: number): SharedProfile[] {
  const value = cookies.get(CONTACT_SHARED_COOKIE);
  if (!value || value.length > 4000) return [];
  try {
    const segments = value.split(':');
    if (segments.length !== 3 || segments.some(part => Buffer.from(part, 'base64').toString('base64') !== part)) return [];
    const entries = JSON.parse(decrypt(value, SHARED_PURPOSE));
    if (!Array.isArray(entries) || entries.length > 16) return [];
    return entries.filter((entry): entry is SharedProfile => Boolean(entry) &&
      typeof entry.profileId === 'string' && entry.profileId.length <= 200 &&
      Number.isFinite(entry.sharedAt) && entry.sharedAt <= now && now - entry.sharedAt < SHARED_TTL);
  } catch { return []; }
}

export function hasSharedContact(cookies: Cookies, profileId: string, now = Date.now()): boolean {
  return sharedProfiles(cookies, now).some(entry => entry.profileId === profileId);
}

export function rememberContactShare(cookies: Cookies, url: URL, profileId: string, now = Date.now()) {
  // IT: Bound browser storage to the sixteen most recent profiles and prune expired receipts.
  const entries = sharedProfiles(cookies, now).filter(entry => entry.profileId !== profileId).slice(-15);
  entries.push({ profileId, sharedAt: now });
  cookies.set(CONTACT_SHARED_COOKIE, encrypt(JSON.stringify(entries), SHARED_PURPOSE), {
    path: '/u', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: SHARED_TTL / 1000
  });
}
