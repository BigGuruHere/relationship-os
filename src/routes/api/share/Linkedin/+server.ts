// PURPOSE: upsert a Lead keyed by ownerId + linkedinIdx
// SECURITY: ownerId derived from session, never from client
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';

function normalizeLinkedInUrl(u: string) {
  try {
    const url = new URL(u);
    // IT: canonicalize to base host + path only
    const clean = `https://www.linkedin.com${url.pathname}`.replace(/\/+$/, '');
    return clean.toLowerCase();
  } catch {
    return '';
  }
}

async function upsertLeadForLinkedIn(ownerId: string, rawUrl: string) {
  const cleaned = normalizeLinkedInUrl(rawUrl);
  if (!cleaned) throw new Error('bad linkedin url');

  const linkedinIdx = buildIndexToken(cleaned);
  const linkedinEnc = encrypt(cleaned, 'lead.linkedin');

  // IT: try update existing pending lead first
  const existing = await prisma.lead.findFirst({
    where: { ownerId, linkedinIdx }
  });

  if (existing) {
    // IT: make sure encryption is stored if missing
    if (!existing.linkedinEnc) {
      await prisma.lead.update({
        where: { id: existing.id },
        data: { linkedinEnc }
      });
    }
    return existing.id;
  }

  // IT: create a fresh pending lead without contactId yet
  const created = await prisma.lead.create({
    data: {
      ownerId,
      contactId: null,
      emailIdx: null,
      phoneIdx: null,
      linkedinIdx,
      linkedinEnc,
      status: 'PENDING'
    },
    select: { id: true }
  });

  return created.id;
}
