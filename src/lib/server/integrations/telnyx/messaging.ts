// Stage 8.18: verify signed Telnyx events and send the one-time onboarding notice.
// No raw SMS body or destination number is written to application logs.
import { createPublicKey, verify } from 'node:crypto';

export function verifyTelnyxWebhook(raw: string, timestamp: string | null, signature: string | null,
  publicKey = process.env.TELNYX_PUBLIC_KEY) {
  // Missing verification configuration is an error, not a silent authentication fallback.
  if (publicKey === undefined) throw new Error('[Relish config] Missing required environment variable: TELNYX_PUBLIC_KEY');
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !signature || !publicKey) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  try {
    // Telnyx gives the 32-byte raw Ed25519 key in base64. DER wraps it as SPKI.
    const key = Buffer.from(publicKey.trim(), 'base64');
    const sig = Buffer.from(signature, 'base64');
    if (key.length !== 32 || sig.length !== 64) return false;
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key]);
    return verify(null, Buffer.from(`${timestamp}|${raw}`, 'utf8'),
      createPublicKey({ key: spki, format: 'der', type: 'spki' }), sig);
  } catch { return false; }
}

export async function sendTelnyxSms(to: string, text: string) {
  const apiKey = process.env.TELNYX_API_KEY;
  const from = process.env.RELISH_DORIAN_SMS_NUMBER;
  if (!apiKey || !from) throw new Error('TELNYX_SMS_NOT_CONFIGURED');
  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, text }), signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`TELNYX_SMS_HTTP_${response.status}`);
}
