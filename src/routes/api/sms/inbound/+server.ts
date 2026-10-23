// Stage 8.18: Telnyx Messaging Profile inbound webhook (replaces legacy Twilio TwiML).
// A signed, fresh Telnyx message plus unspent QR invitation is required to originate a call.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyTelnyxWebhook } from '$lib/server/integrations/telnyx/messaging';
import { consumePilotSmsForCallback } from '$lib/server/core/pilotSmsCallback';

export const POST: RequestHandler = async ({ request, locals }) => {
  const raw = await request.text();
  if (!verifyTelnyxWebhook(raw, request.headers.get('telnyx-timestamp'), request.headers.get('telnyx-signature-ed25519')))
    return json({ error: 'Invalid signature' }, { status: 401 });
  let event: any;
  try { event = JSON.parse(raw); } catch { return json({ error: 'Invalid payload' }, { status: 400 }); }
  if (event?.data?.event_type !== 'message.received') return json({ status: 'ignored' });
  const p = event.data.payload;
  // Check both destinations and message id; no implicit caller lookup from browser cookies.
  const result = await consumePilotSmsForCallback({
    messageId: String(p?.id || ''), from: p?.from?.phone_number,
    to: p?.to?.[0]?.phone_number, body: p?.text, environment: locals.env
  });
  // Already claimed codes receive 200 on webhook retries, never another call.
  return json({ status: result });
};
