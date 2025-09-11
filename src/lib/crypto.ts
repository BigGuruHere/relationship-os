// src/lib/crypto.ts
// PURPOSE: Provide deterministic, indexable HMAC for equality search
//          and AES-256-GCM for encrypting plaintext at rest.
//
// ENV:
// - SECRET_MASTER_KEY: 32 bytes in hex (64 chars). Example: `openssl rand -hex 32`
//
// SECURITY NOTES:
// - We derive two subkeys (encKey/macKey) via HKDF so encryption and HMAC keys are isolated.
// - We normalize inputs before hashing so your searches match your chosen semantics.

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

// ---- Normalization rules for indexable fields -------------------------------
// Adjust to your needs (e.g., keep case for names if you want case-sensitive searches)
export function normalizeForIndex(input: string) {
  return input.normalize('NFC').trim().toLowerCase();
}

// ---- Deterministic HMAC index (equality search) -----------------------------
export function buildIndexToken(input: string) {
  const norm = normalizeForIndex(input);
  const h = crypto.createHmac('sha256', macKey);
  h.update(norm, 'utf8');
  return h.digest('hex'); // 64 hex chars
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
