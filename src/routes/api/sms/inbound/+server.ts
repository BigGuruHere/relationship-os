// src/routes/api/sms/inbound/+server.ts
// PURPOSE: handle incoming SMS keyword and reply with a TwiML XML message.
// BUILD: no external deps - builds in Vite without special config.
// SECURITY: do not echo back sensitive info.

import type { RequestHandler } from './$types';

// Minimal XML escape for user controlled text
function xmlEscape(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const POST: RequestHandler = async ({ request }) => {
  // Twilio posts form-encoded fields
  const form = await request.formData();
  const from = String(form.get('From') ?? '');
  const body = String(form.get('Body') ?? '').trim();

  // Your static link values - you can later derive these per account or slug
  const connectLink = 'https://yourapp.com/u/terence';
  const vcardLink =
    'https://yourapp.com/api/vcard?name=Your%20Name&link=' +
    encodeURIComponent(connectLink);

  // Build the reply message
  const message =
    `Great to meet you. Save my contact: ${vcardLink}\n` +
    `Connect here: ${connectLink}`;

  // TwiML response - wrap the text, escape for XML safety
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${xmlEscape(message)}</Message>
</Response>`;

  return new Response(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  });
};
