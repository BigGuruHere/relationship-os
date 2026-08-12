// src/lib/server/magic.ts
// PURPOSE:
// - Create and send magic links without importing a session module
// - Build absolute URLs using an env-aware origin
// BUILD SAFE:
// - No import from src/lib/server/session
// DEPENDENCIES:
// - Only createMagicToken from your tokens helper
// CHANNELS:
// - If "to" contains "@", treat as email, else as SMS
// SENDING:
// - This stub logs the link - replace the TODO blocks with your email or SMS provider
// NOTES:
// - All IT code is commented and uses hyphens only

import { createMagicToken } from '$lib/server/tokens';
import { absoluteUrlFromOrigin } from '$lib/url';

type SendArgs = {
  userId: string;   // recipient user id
  to: string;       // email or phone
  origin?: string;  // absolute origin from locals.appOrigin - optional with safe fallback
};

// Resolve an origin with a safe fallback for tests or ad hoc calls
function resolveOriginFallback(origin?: string): string {
  // Prefer the provided origin from callers like endpoints using locals.appOrigin
  if (origin && origin.trim()) return origin.trim();

  // Fall back to env for non-request contexts
  const raw =
    process.env.APP_ORIGIN ??
    process.env.APP_ORIGIN_DEV ??
    process.env.APP_ORIGIN_PROD ??
    'http://localhost:5173';

  try {
    const u = new URL(raw);
    return u.toString().replace(/\/$/, ''); // strip trailing slash
  } catch {
    return 'http://localhost:5173';
  }
}

/**
 * Build the one click magic link that the email or SMS will contain.
 * The link points to the API that verifies the token and sets the session cookie.
 */
export async function buildMagicLink(userId: string, origin?: string): Promise<string> {
  // 1 - mint a short lived single use token
  const token = await createMagicToken({ userId });

  // 2 - compose an absolute link to the API route that exchanges token for a session
  // Using API keeps the page simple and relies on server to set httpOnly cookie
  const base = resolveOriginFallback(origin);
  const link = absoluteUrlFromOrigin(base, '/api/auth/magic-link', { token });

  return link;
}

/**
 * Send a magic link to an email or phone.
 * Replace the TODO sections with your real email or SMS send.
 */
export async function sendMagicLink({ userId, to, origin }: SendArgs) {
  // Build env-aware absolute link
  const link = await buildMagicLink(userId, origin);

  // Basic channel detection - email if contains "@", otherwise SMS
  const isEmail = to.includes('@');

  if (isEmail) {
    // TODO: send email with your provider here
    // await sendEmail({ to, subject: 'Your sign in link', html: htmlEmail(link) });
    console.log('[magic-link email]', to, link);
  } else {
    // TODO: send SMS with your provider here
    // await sendSms({ to, message: `Sign in: ${link}` });
    console.log('[magic-link sms]', to, link);
  }

  // No return value needed
}

// Optional tiny email body helper if you wire a provider later
export function htmlEmail(link: string) {
  const safe = escapeHtml(link);
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <p>Click to sign in:</p>
      <p><a href="${safe}">${safe}</a></p>
      <p>This link will expire shortly.</p>
    </div>
  `;
}

// Minimal escaping for safety in HTML emails
function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
