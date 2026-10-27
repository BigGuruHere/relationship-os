import { requiredEnv } from '../../config/requiredEnv.ts';
// PURPOSE: Direct ElevenLabs conversation adapter for the provider-independent Relish conversation source.
// SECURITY: Webhook signatures are verified before any provider payload enters workspace custody.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ParsedTranscript, TranscriptTurn } from '../../datingTranscriptImportPolicy';
import { normalizePhoneForIdentity } from './phone.ts';

export type ElevenLabsConversationData = {
  conversation_id?: unknown;
  agent_id?: unknown;
  agent_name?: unknown;
  status?: unknown;
  user_id?: unknown;
  transcript?: unknown;
  metadata?: unknown;
  conversation_initiation_client_data?: unknown;
  analysis?: unknown;
};

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function extractCallerPhone(input: ElevenLabsConversationData, metadata: Record<string, any>, dynamicVariables: Record<string, any>) {
  const phoneCall = asObject(metadata.phone_call);
  const telephony = asObject(metadata.telephony);
  const body = asObject(metadata.body);
  return normalizePhoneForIdentity(firstNonEmpty(
    dynamicVariables.system__caller_id,
    dynamicVariables.caller_id,
    phoneCall.caller_id,
    phoneCall.caller_number,
    telephony.caller_id,
    metadata.caller_id,
    body.Caller,
    body.From
  ));
}


function extractCalledNumber(metadata: Record<string, any>, dynamicVariables: Record<string, any>) {
  const phoneCall = asObject(metadata.phone_call);
  const telephony = asObject(metadata.telephony);
  const body = asObject(metadata.body);
  return normalizePhoneForIdentity(firstNonEmpty(
    dynamicVariables.system__called_number,
    dynamicVariables.called_number,
    phoneCall.called_number,
    phoneCall.to,
    telephony.called_number,
    metadata.called_number,
    body.Called,
    body.To
  ));
}

export type ElevenLabsSignatureCheck = {
  valid: boolean;
  reason: 'OK' | 'MISSING_SECRET' | 'MISSING_SIGNATURE' | 'MALFORMED_SIGNATURE' | 'STALE_TIMESTAMP' | 'HASH_MISMATCH';
  timestamp: number | null;
  ageSeconds: number | null;
  scheme: string | null;
};

export function inspectElevenLabsSignature(rawBody: string, signatureHeader: string | null, secretInput: string, nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = 1800): ElevenLabsSignatureCheck {
  const secret = String(secretInput || '').trim();
  if (!secret) return { valid: false, reason: 'MISSING_SECRET', timestamp: null, ageSeconds: null, scheme: null };
  const header = String(signatureHeader || '').trim();
  if (!header) return { valid: false, reason: 'MISSING_SIGNATURE', timestamp: null, ageSeconds: null, scheme: null };

  // Match ElevenLabs' SDK verifier: ElevenLabs-Signature is `t=<unix>,v0=<hex hmac>`
  // and the signed message is exactly `${timestamp}.${rawRawBody}`.
  const parts = Object.fromEntries(header.split(',').map(part => part.trim().split('=', 2)).filter(pair => pair.length === 2));
  const timestamp = Number(parts.t);
  const supplied = String(parts.v0 || '');
  if (!Number.isFinite(timestamp) || !/^[a-f0-9]{64}$/i.test(supplied)) {
    return { valid: false, reason: 'MALFORMED_SIGNATURE', timestamp: Number.isFinite(timestamp) ? timestamp : null, ageSeconds: null, scheme: parts.v0 ? 'v0' : null };
  }

  const ageSeconds = nowSeconds - timestamp;
  // ElevenLabs' SDK accepts signatures up to 30 minutes old. Keep the same default so
  // webhook delivery/retry latency cannot cause a false rejection. This can still be tightened.
  const maxAge = maxAgeSeconds;
  if (ageSeconds > maxAge) return { valid: false, reason: 'STALE_TIMESTAMP', timestamp, ageSeconds, scheme: 'v0' };

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const valid = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
  return { valid, reason: valid ? 'OK' : 'HASH_MISMATCH', timestamp, ageSeconds, scheme: 'v0' };
}

export function verifyElevenLabsSignature(rawBody: string, signatureHeader: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  return inspectElevenLabsSignature(rawBody, signatureHeader, secret, nowSeconds).valid;
}

export function normalizeElevenLabsConversation(input: ElevenLabsConversationData, ingestMethod: 'ELEVENLABS_WEBHOOK' | 'ELEVENLABS_API') {
  const conversationId = String(input?.conversation_id || '').trim();
  if (!conversationId || conversationId.length > 240) throw new Error('ElevenLabs conversation_id is missing or invalid.');
  const transcript = Array.isArray(input?.transcript) ? input.transcript : [];
  const turns: TranscriptTurn[] = [];
  const speakers = new Set<string>();
  for (const item of transcript) {
    const row = asObject(item);
    const role = String(row.role || '').trim().toLowerCase();
    const message = String(row.message ?? '').replace(/\r\n?/g, '\n').trim();
    if (!message || (role !== 'user' && role !== 'agent')) continue;
    const speaker = role === 'user' ? 'User' : 'Agent';
    speakers.add(speaker);
    turns.push({ id: `T${String(turns.length + 1).padStart(3, '0')}`, speaker, text: `${speaker}: ${message}` });
    if (turns.length > 600) throw new Error('ElevenLabs conversation exceeds the 600-turn import limit.');
  }
  if (!turns.some(turn => turn.speaker === 'User')) throw new Error('ElevenLabs conversation has no participant speech to retain.');
  const metadata = asObject(input?.metadata);
  const started = Number(metadata.start_time_unix_secs);
  const occurredAt = Number.isFinite(started) && started > 0 ? new Date(started * 1000) : null;
  const parsed: ParsedTranscript = { turns, speakers: [...speakers], text: turns.map(turn => turn.text).join('\n') };
  const clientData = asObject(input?.conversation_initiation_client_data);
  const dynamicVariables = asObject(clientData.dynamic_variables);
  const callerPhone = extractCallerPhone(input, metadata, dynamicVariables);
  const calledNumber = extractCalledNumber(metadata, dynamicVariables);
  const analysis = asObject(input?.analysis);
  const transcriptSummary = firstNonEmpty(analysis.transcript_summary).slice(0, 4000) || null;
  return {
    parsed,
    metadata: {
      provider: 'ELEVENLABS' as const,
      ingestMethod,
      externalConversationId: conversationId,
      agentName: String(input?.agent_name || '').trim() || null,
      occurredAt,
      providerUserId: String(input?.user_id || '').trim() || null,
      callerPhone,
      summary: transcriptSummary
    },
    agentId: String(input?.agent_id || '').trim(),
    userId: String(input?.user_id || '').trim(),
    callerPhone,
    calledNumber,
    dynamicVariables
  };
}

export async function fetchElevenLabsConversation(conversationId: string, apiKey = requiredEnv('ELEVENLABS_API_KEY')) {
  const id = String(conversationId || '').trim();
  if (!id || id.length > 240 || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Enter a valid ElevenLabs conversation ID.');
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured.');
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(id)}?format=json`, {
    headers: { 'xi-api-key': apiKey, accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`ElevenLabs conversation fetch failed (${response.status}).`);
  return await response.json() as ElevenLabsConversationData;
}
