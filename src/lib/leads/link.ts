// src/lib/leads/link.ts
// PURPOSE: Link pending leads to a newly authenticated user by deterministic indexes
// - Supports email, phone, and LinkedIn equality matching
// - Claims matching leads and links any associated Contact to the new platform user
// - Creates reciprocal contacts for each distinct owner once
// SECURITY:
// - Uses deterministic HMAC indexes - never handles plaintext PII in WHERE clauses
// - Never trusts client provided owner ids - only acts on leads found by secure indexes

import type { AppTransactionClient } from '$lib/db';
import { withLegacyAccountClaims } from '$lib/server/foundation/provisioning';
import { buildIndexToken } from '$lib/crypto';
import { createReciprocalContactIfMissing } from './reciprocal';
import { requireUserPersonId } from '$lib/server/core/identity';
import {
  requireConfiguredDefaultContextSpaceIdForOwner,
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
  return withLegacyAccountClaims(userId, async tx => {
    const contextSpaceId = await requireConfiguredDefaultContextSpaceIdForOwner(tx, userId);
    return runWithWorkspaceCustody({ userId, contextSpaceId }, () => linkLeadsForUserFlexibleInCustody(tx, userId, opts));
  }, { claimedLeadIds: [], touchedContactIds: [], owners: [] });
}

async function linkLeadsForUserFlexibleInCustody(
  tx: AppTransactionClient,
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
  const leads = await tx.lead.findMany({
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
  const personId = await requireUserPersonId(userId, tx);

  // IT: Claim each existing Contact in its ORIGINAL custody. Lead is account-level
  // bookkeeping and stores contactId; resolving a default space here would be wrong.
  const owners = Array.from(new Set(leads.map((l) => l.ownerId)));
  const contactContexts = new Map<string, string>();
  for (const lead of leads) {
    if (!lead.contactId) continue;
    // SECURITY: Read ONLY custody metadata using a parameterised query; the scoped Prisma
    // Contact API deliberately rejects cross-owner reads from the claimant's request.
    // No personal data or Contact fields are fetched or exposed.
    const metadata = await tx.$queryRaw<Array<{ contextSpaceId: string }>>`
      SELECT "contextSpaceId" FROM "Contact"
      WHERE "id" = ${lead.contactId} AND "userId" = ${lead.ownerId} LIMIT 1
    `;
    if (metadata.length !== 1) throw new Error('A lead references an unavailable owned Contact.');
    contactContexts.set(lead.id, metadata[0].contextSpaceId);
  }

  // SECURITY: Lead itself is account-level claim bookkeeping. Updating the prior owner's Contact is
  // contextual and therefore enters that owner's custody only through the LEAD_CLAIM boundary.
  for (const lead of leads) {
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: 'CLAIMED', claimedByUserId: userId }
    });

    if (lead.contactId) {
      const targetContextSpaceId = contactContexts.get(lead.id);
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

  const claimedLeadIds = leads.map((l) => l.id);
  const touchedContactIds = leads.map((l) => l.contactId).filter(Boolean) as string[];

  // IT: create a reciprocal Contact once per owner in the claimant's active custody.
  for (const ownerId of owners) {
    // Preserve best-effort reciprocal writes without poisoning the enclosing transaction.
    await tx.$executeRawUnsafe('SAVEPOINT f203_reciprocal');
    try {
      await createReciprocalContactIfMissing(userId, ownerId, tx);
    } catch {
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT f203_reciprocal');
    } finally {
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT f203_reciprocal');
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
