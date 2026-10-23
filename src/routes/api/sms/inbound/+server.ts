// Stage 8.18: Telnyx Messaging Profile inbound webhook (replaces legacy Twilio TwiML).
// A signed, fresh Telnyx message plus unspent QR invitation is required to originate a call.
import { randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyTelnyxWebhook } from '$lib/server/integrations/telnyx/messaging';
import { consumePilotSmsForCallback, logPilotSmsCallback } from '$lib/server/core/pilotSmsCallback';

export const POST: RequestHandler = async ({ request, locals }) => {
  // A random request ID allows correlating the webhook with service logs without PII.
  const requestId = randomUUID();
  const raw = await request.text();
  if (!verifyTelnyxWebhook(raw, request.headers.get('telnyx-timestamp'), request.headers.get('telnyx-signature-ed25519'))) {
    logPilotSmsCallback('webhook.rejected', { requestId, environment: locals.env, reason: 'INVALID_SIGNATURE' }, 'warn');
    return json({ error: 'Invalid signature' }, { status: 401 });
  }
  let event: any;
  try { event = JSON.parse(raw); } catch {
    logPilotSmsCallback('webhook.rejected', { requestId, environment: locals.env, reason: 'INVALID_JSON' }, 'warn');
    return json({ error: 'Invalid payload' }, { status: 400 });
  }
  if (event?.data?.event_type !== 'message.received') {
    logPilotSmsCallback('webhook.ignored', { requestId, environment: locals.env, reason: 'OTHER_EVENT' });
    return json({ status: 'ignored' });
  }
  // Log event metadata, not the SMS content, phone numbers or original Telnyx payload.
  const eventId = String(event?.data?.id || '');
  logPilotSmsCallback('webhook.received', { requestId, environment: locals.env,
    ...( /^[0-9a-f-]{36}$/i.test(eventId) ? { eventId } : {} ) });
  const p = event.data.payload;
  // Check both destinations and message id; no implicit caller lookup from browser cookies.
  const result = await consumePilotSmsForCallback({
    messageId: String(p?.id || ''), from: p?.from?.phone_number,
    to: p?.to?.[0]?.phone_number, body: p?.text, environment: locals.env, requestId
  });
  // Already claimed codes receive 200 on webhook retries, never another call.
  logPilotSmsCallback('webhook.completed', { requestId, environment: locals.env, reason: result });
  return json({ status: result });
};
