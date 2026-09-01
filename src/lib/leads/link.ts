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
import { requireUserPersonId } from '$lib/server/core/identity';
import {
  requireSingleContextSpaceIdForOwner,
  runWithCrossOwnerWorkspaceCustody,
  runWithWorkspaceCustody
} from '$lib/server/core/contextSpace';

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
  // SECURITY: Authentication callbacks can begin without request custody and only establish the
  // user during the request. Enter the claimant's current/default ContextSpace explicitly here.
  const contextSpaceId = await requireSingleContextSpaceIdForOwner(prisma as any, userId);
  return runWithWorkspaceCustody({ userId, contextSpaceId }, () => linkLeadsForUserFlexibleInCustody(userId, opts));
}

async function linkLeadsForUserFlexibleInCustody(
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

  // IT: Stage 8.1 links claimed Contacts to the canonical Person for this registered user as well as linkedUserId.
  const personId = await requireUserPersonId(userId);

  // IT: Resolve every destination before changing claim state. Stage 8.7 refuses to guess if
  // any prior lead owner has more than one ContextSpace.
  const owners = Array.from(new Set(leads.map((l) => l.ownerId)));
  const ownerContextEntries = await Promise.all(owners.map(async (ownerId) => [
    ownerId,
    await requireSingleContextSpaceIdForOwner(prisma as any, ownerId)
  ] as const));
  const ownerContextIds = new Map(ownerContextEntries);

  // SECURITY: Lead itself is account-level claim bookkeeping. Updating the prior owner's Contact is
  // contextual and therefore enters that owner's custody only through the LEAD_CLAIM boundary.
  await prisma.$transaction(async (tx) => {
    for (const lead of leads) {
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: 'CLAIMED', claimedByUserId: userId }
      });

      if (lead.contactId) {
        const targetContextSpaceId = ownerContextIds.get(lead.ownerId);
        if (!targetContextSpaceId) throw new Error(`Missing resolved ContextSpace for lead owner ${lead.ownerId}.`);

        await runWithCrossOwnerWorkspaceCustody(
          {
            sourceUserId: userId,
            targetUserId: lead.ownerId,
            targetContextSpaceId,
            reason: 'LEAD_CLAIM'
          },
          () => tx.contact.update({
            where: { id: lead.contactId, userId: lead.ownerId, contextSpaceId: targetContextSpaceId },
            data: { linkedUserId: userId, personId }
          })
        );
      }
    }
  });

  const claimedLeadIds = leads.map((l) => l.id);
  const touchedContactIds = leads.map((l) => l.contactId).filter(Boolean) as string[];

  // IT: create a reciprocal Contact once per owner in the claimant's active custody.
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
