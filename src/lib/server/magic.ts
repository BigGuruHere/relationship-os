// PURPOSE: create and send magic links without importing a session module.
// BUILD SAFE: no import from src/lib/server/session.
// DEPENDENCIES: only createMagicToken from your auth or tokens helper.
// CHANNELS: if "to" contains "@", we treat it as email, else as SMS.
// SENDING: this stub logs the link - replace the two TODO blocks with your email or SMS provider.
// All IT code is commented and uses hyphens only.

import { createMagicToken } from '$lib/server/tokens'; // or '$lib/server/tokens' if that is where you defined it

const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:5173';

type SendArgs = {
  userId: string; // recipient user id
  to: string;     // email or phone
};

/**
 * Build the one click magic link that lands on /auth/magic?token=...
 */
export async function buildMagicLink(userId: string) {
  // 1 - mint a short lived single use token
  const token = await createMagicToken({ userId });
  // 2 - compose the link to the page route that will exchange token for a session
  const link = `${APP_ORIGIN}/auth/magic?token=${encodeURIComponent(token)}`;
  return { token, link };
}

/**
 * Send a magic link to an email or phone.
 * Replace the TODO sections with your real email or SMS send.
 */
export async function sendMagicLink({ userId, to }: SendArgs) {
  const { link } = await buildMagicLink(userId);

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
