// PURPOSE: Development observability for the ElevenLabs <-> Relish bridge.
// SECURITY: Off by default. Authentication credentials are never logged. Full conversation/LU payloads require an additional explicit opt-in.
import { randomUUID } from 'node:crypto';

const enabled = () => process.env.ELEVENLABS_DEBUG_LOGGING === 'YES';
const payloadsEnabled = () => process.env.ELEVENLABS_DEBUG_LOG_PAYLOADS === 'YES';

export function elevenLabsTraceId(prefix = 'el') {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function replacer(key: string, value: unknown) {
  const lower = key.toLowerCase();
  if (lower.includes('authorization') || lower.includes('signature') || lower.includes('secret') || lower.includes('api_key') || lower.includes('apikey')) {
    return '[REDACTED]';
  }
  return value;
}

function printable(value: unknown) {
  try {
    return JSON.stringify(value, replacer, 2);
  } catch {
    return String(value);
  }
}

export function elevenLabsLog(traceId: string, phase: string, message: string, details?: unknown) {
  if (!enabled()) return;
  const header = `[ElevenLabs][${traceId}][${phase}] ${message}`;
  if (details === undefined) {
    console.log(header);
    return;
  }
  console.log(`${header}\n${printable(details)}`);
}

export function elevenLabsPayloadLog(traceId: string, phase: string, message: string, payload: unknown) {
  if (!enabled()) return;
  if (!payloadsEnabled()) {
    console.log(`[ElevenLabs][${traceId}][${phase}] ${message} (payload hidden; set ELEVENLABS_DEBUG_LOG_PAYLOADS=YES to display it)`);
    return;
  }
  console.log(`[ElevenLabs][${traceId}][${phase}] ${message}\n${printable(payload)}`);
}

export function elevenLabsErrorLog(traceId: string, phase: string, message: string, error?: unknown) {
  if (!enabled()) return;
  const details = error instanceof Error
    ? { name: error.name, message: error.message, stack: process.env.NODE_ENV === 'production' ? undefined : error.stack }
    : error;
  console.error(`[ElevenLabs][${traceId}][${phase}] ${message}${details === undefined ? '' : `\n${printable(details)}`}`);
}
