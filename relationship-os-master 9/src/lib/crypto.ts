// src/lib/crypto.ts
// PURPOSE: Provide deterministic, indexable HMAC for equality search
//          and AES-256-GCM for encrypting plaintext at rest. Adds scoped
//          helpers for encrypted email lookups on User.
// SECURITY:
// - Derive independent encKey and macKey from a single high-entropy master via HKDF.
// - Deterministic HMAC indexes are for equality search only - never reversible.
// - All normalization happens server-side so lookups are stable and privacy-safe.
//
// ENV:
// - SECRET_MASTER_KEY: 32 bytes in hex (64 chars). Example: `openssl rand -hex 32`

import crypto from 'crypto';

// ---- Load & validate master key --------------------------------------------
const MASTER_HEX = process.env.SECRET_MASTER_KEY ?? '';
if (MASTER_HEX.length !== 64) {
  throw new Error('SECRET_MASTER_KEY must be 32 bytes (64 hex chars).');
}
const masterKey = Buffer.from(MASTER_HEX, 'hex');

// ---- Derive separate keys via HKDF (SHA-256) --------------------------------
const HKDF_SALT = Buffer.alloc(0); // acceptable if master is high-entropy
const INFO_ENC  = Buffer.from('personal-crm:enc-key:v1');
const INFO_MAC  = Buffer.from('personal-crm:mac-key:v1');

const encKey = crypto.hkdfSync('sha256', masterKey, HKDF_SALT, INFO_ENC, 32); // 32B
const macKey = crypto.hkdfSync('sha256', masterKey, HKDF_SALT, INFO_MAC, 32); // 32B

const GCM_IV_LEN = 12; // 96-bit IV recommended for GCM

// ---- Normalization rules ----------------------------------------------------
// IT: General-purpose normalization for fields you want equality search on.
// - NFC to fold equivalent unicode sequences
// - trim to remove accidental whitespace
// - toLowerCase to make search case-insensitive
export function normalizeForIndex(input: string) {
  return input.normalize('NFC').trim().toLowerCase();
}

// IT: Email-specific normalization - uses the same rules for now.
// - Keep separate in case you later add provider-specific tweaks.
export function normalizeEmail(input: string) {
  return normalizeForIndex(input);
}

// ---- Deterministic HMAC index builders --------------------------------------
// IT: Core HMAC - returns a Buffer so callers can choose hex or bytes storage.
// - scope prefixes the message so different fields cannot be correlated even
//   if their normalized values are equal. Example scopes: "contact:email", "user:email".
function hmacIndexBytes(normValue: string, scope = 'default') {
  const h = crypto.createHmac('sha256', macKey);
  // Include a clear scope prefix and a separator byte to avoid accidental overlaps
  h.update(`scope:${scope}\n`, 'utf8');
  h.update(normValue, 'utf8');
  return h.digest(); // 32-byte Buffer
}

// IT: Legacy hex helper kept for backward compatibility with existing *_Idx hex columns.
export function buildIndexToken(input: string) {
  const norm = normalizeForIndex(input);
  return hmacIndexBytes(norm, 'generic').toString('hex'); // 64 hex chars
}

// IT: New generic bytes helper for Prisma Bytes columns.
export function buildIndexTokenBytes(input: string, scope = 'generic') {
  const norm = normalizeForIndex(input);
  return hmacIndexBytes(norm, scope);
}

// IT: Email index helpers - pick hex or bytes based on your Prisma schema.
// - If User.email_Idx is Bytes, use buildEmailIndexBytes.
// - If it is String, use buildEmailIndexHex.
export function buildEmailIndexHex(email: string) {
  const norm = normalizeEmail(email);
  return hmacIndexBytes(norm, 'user:email').toString('hex');
}

export function buildEmailIndexBytes(email: string) {
  const norm = normalizeEmail(email);
  return hmacIndexBytes(norm, 'user:email');
}

// ---- AES-256-GCM encrypt/decrypt -------------------------------------------
export function encrypt(plaintext: string, aad?: string): string {
  // Generate random IV for each encryption
  const iv = crypto.randomBytes(GCM_IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Return compact base64 triple "iv:ciphertext:tag"
  return `${iv.toString('base64')}:${ct.toString('base64')}:${tag.toString('base64')}`;
}

export function decrypt(payload: string, aad?: string): string {
  const [ivB64, ctB64, tagB64] = payload.split(':');
  if (!ivB64 || !ctB64 || !tagB64) throw new Error('Malformed encrypted payload');
  const iv  = Buffer.from(ivB64, 'base64');
  const ct  = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
