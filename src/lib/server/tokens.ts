// PURPOSE: create and verify short lived tokens for invites and magic links.
// SECURITY: we store only an HMAC of the token - never the raw token. The raw token is sent to the user.
// All IT code is commented and uses hyphens only.

import crypto from 'node:crypto';
import { prisma } from '$lib/db';

const HMAC_SECRET = process.env.SESSION_COOKIE_SECRET || 'change-me';

// IT: helper to HMAC a token for storage
function hmac(input: string) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(input).digest('hex');
}

// IT: generate a url safe random token
function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url'); // url safe
}

// ---------------- Invite tokens ----------------

export async function createInviteToken(args: { ownerId: string; ttlMinutes: number }) {
  const raw = randomToken();
  const tokenHash = hmac(raw);
  const expiresAt = new Date(Date.now() + args.ttlMinutes * 60 * 1000);

  await prisma.inviteToken.create({
    data: { ownerId: args.ownerId, tokenHash, expiresAt }
  });

  return { token: raw, expiresAt };
}

export async function verifyInviteToken(rawToken: string) {
  const tokenHash = hmac(rawToken);
  const now = new Date();
  const row = await prisma.inviteToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    select: { id: true, ownerId: true }
  });
  return row || null;
}

// ---------------- Magic tokens ----------------

export async function createMagicToken(args: { userId: string; ttlMinutes: number }) {
  const raw = randomToken();
  const tokenHash = hmac(raw);
  const expiresAt = new Date(Date.now() + args.ttlMinutes * 60 * 1000);

  await prisma.magicToken.create({
    data: { userId: args.userId, tokenHash, expiresAt }
  });

  return { token: raw, expiresAt };
}

export async function verifyMagicToken(rawToken: string) {
  const tokenHash = hmac(rawToken);
  const now = new Date();
  const row = await prisma.magicToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    select: { id: true, userId: true }
  });
  return row || null;
}

export async function markMagicTokenUsed(id: string) {
  await prisma.magicToken.update({ where: { id }, data: { usedAt: new Date() } });
}
