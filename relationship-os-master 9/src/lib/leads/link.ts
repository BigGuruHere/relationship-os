// src/lib/leads/link.ts
// PURPOSE: Link pending leads to a newly authenticated user by deterministic indexes
// - Supports email, phone, and LinkedIn equality matching
// - Claims matching leads and links any associated Contact to the new platform user
// - Creates reciprocal contacts for each distinct owner once
// SECURITY:
// - Uses deterministic HMAC indexes - never handles plaintext PII in WHERE clauses
// - Never trusts client provided owner ids - only acts on leads found by secure indexes

import { prisma } from '$lib/db';
import { buildIndexToken } from '$lib/crypto';
import { createReciprocalContactIfMissing } from './reciprocal';

// IT: tiny helper to canonicalize LinkedIn profile URLs so the index is stable
function normalizeLinkedInUrl(u: string | undefined | null): string {
  if (!u) return '';
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    if (!host.includes('linkedin.com')) return '';
    const baseHost = 'www.linkedin.com';
    const path = url.pathname.replace(/\/+$/, '');
    if (!path || path === '/') return '';
    return `https://${baseHost}${path}`.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * IT: New flexible API
 * - Matches pending leads for this person by any available index
 * - Claims them and links underlying contacts
 * - Creates reciprocal contacts for each distinct owner
 */
export async function linkLeadsForUserFlexible(
  userId: string,
  opts: { email?: string; phone?: string; linkedinUrl?: string }
): Promise<{ claimedLeadIds: string[]; touchedContactIds: string[]; owners: string[] }> {
  // IT: build available deterministic indexes
  const emailIdx = opts.email ? buildIndexToken(opts.email) : null;
  const phoneIdx = opts.phone ? buildIndexToken(opts.phone) : null;

  const normalizedLinkedIn = normalizeLinkedInUrl(opts.linkedinUrl ?? '');
  const linkedinIdx = normalizedLinkedIn ? buildIndexToken(normalizedLinkedIn) : null;

  // IT: if nothing to match on, exit early
  if (!emailIdx && !phoneIdx && !linkedinIdx) {
    return { claimedLeadIds: [], touchedContactIds: [], owners: [] };
  }

  // IT: find pending leads that match any of the provided indexes
  const leads = await prisma.lead.findMany({
    where: {
      status: 'PENDING',
      OR: [
        ...(emailIdx ? [{ emailIdx }] : []),
        ...(phoneIdx ? [{ phoneIdx }] : []),
        ...(linkedinIdx ? [{ linkedinIdx }] : [])
      ]
    },
    select: { id: true, contactId: true, ownerId: true }
  });

  if (leads.length === 0) {
    return { claimedLeadIds: [], touchedContactIds: [], owners: [] };
  }

  // IT: claim leads and link any associated contacts to this user
  const tx: any[] = [];
  for (const lead of leads) {
    tx.push(
      prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'CLAIMED', claimedByUserId: userId }
      })
    );
    if (lead.contactId) {
      tx.push(
        prisma.contact.update({
          where: { id: lead.contactId },
          data: { linkedUserId: userId }
        })
      );
    }
  }
  await prisma.$transaction(tx);

  const claimedLeadIds = leads.map((l) => l.id);
  const touchedContactIds = leads.map((l) => l.contactId).filter(Boolean) as string[];

  // IT: dedupe owners and create reciprocal contact once per owner
  const owners = Array.from(new Set(leads.map((l) => l.ownerId)));
  for (const ownerId of owners) {
    try {
      await createReciprocalContactIfMissing(userId, ownerId);
    } catch {
      // IT: never block login on reciprocal failures
    }
  }

  return { claimedLeadIds, touchedContactIds, owners };
}

/**
 * IT: Backward compatible wrapper
 * - Preserves your existing call sites that pass only userEmail
 */
export async function linkLeadsForUser(userId: string, userEmail: string) {
  await linkLeadsForUserFlexible(userId, { email: userEmail });
}
