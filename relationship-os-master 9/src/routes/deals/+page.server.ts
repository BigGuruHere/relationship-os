// src/routes/deals/+page.server.ts
// PURPOSE: Explore relationship-driven deals for the signed-in user.
// SECURITY: All queries are tenant scoped and encrypted fields are decrypted only on the server.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';
import {
  DEAL_STATUSES,
  dealStatusLabel,
  formatDealValue,
  safeDecrypt,
  weightedValueCents
} from '$lib/deals';

const LIMIT = 150;

type DealRow = Awaited<ReturnType<typeof loadDealRows>>[number];

async function loadDealRows(userId: string, status: string | null, q: string) {
  // IT: exact title match can use titleIdx. Partial matching is done after decrypting a bounded set.
  const titleIdx = q ? buildIndexToken(q) : null;

  return prisma.deal.findMany({
    where: {
      userId,
      ...(status ? { status: status as any } : {}),
      ...(titleIdx ? { OR: [{ titleIdx }] } : {})
    },
    select: {
      id: true,
      titleEnc: true,
      descriptionEnc: true,
      valueCents: true,
      currency: true,
      status: true,
      probability: true,
      expectedCloseDate: true,
      closedAt: true,
      updatedAt: true,
      createdAt: true,
      contacts: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          isPrimary: true,
          contact: {
            select: { id: true, fullNameEnc: true, linkedUserId: true }
          }
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      }
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: LIMIT
  });
}

async function loadFallbackRows(userId: string, status: string | null) {
  // IT: bounded fallback rows allow encrypted title and description contains matching.
  return prisma.deal.findMany({
    where: {
      userId,
      ...(status ? { status: status as any } : {})
    },
    select: {
      id: true,
      titleEnc: true,
      descriptionEnc: true,
      valueCents: true,
      currency: true,
      status: true,
      probability: true,
      expectedCloseDate: true,
      closedAt: true,
      updatedAt: true,
      createdAt: true,
      contacts: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          isPrimary: true,
          contact: {
            select: { id: true, fullNameEnc: true, linkedUserId: true }
          }
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      }
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: LIMIT
  });
}

async function mapDealRow(row: DealRow) {
  const title = safeDecrypt(row.titleEnc, 'deal.title', 'Untitled deal');
  const description = safeDecrypt(row.descriptionEnc, 'deal.description', '');
  const preview = description.length > 180 ? `${description.slice(0, 177)}...` : description;
  const contacts = await Promise.all(
    row.contacts.map(async (link: any) => ({
      linkId: link.id,
      contactId: link.contact.id,
      name: await contactDisplayName(link.contact),
      relationshipType: link.relationshipType,
      label: link.label || '',
      isPrimary: link.isPrimary
    }))
  );
  const weighted = weightedValueCents(row.valueCents, row.probability);

  return {
    id: row.id,
    title,
    preview,
    valueCents: row.valueCents,
    valueLabel: formatDealValue(row.valueCents, row.currency),
    weightedValueLabel: weighted === null ? 'No weighted value' : formatDealValue(weighted, row.currency),
    currency: row.currency,
    status: row.status,
    statusLabel: dealStatusLabel(row.status),
    probability: row.probability,
    expectedCloseDate: row.expectedCloseDate,
    closedAt: row.closedAt,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    contacts
  };
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const q = (url.searchParams.get('q') || '').trim();
  const statusParam = (url.searchParams.get('status') || '').trim().toUpperCase();
  const status = DEAL_STATUSES.some((s) => s.value === statusParam) ? statusParam : null;

  const baseRows = q ? await loadFallbackRows(locals.user.id, status) : await loadDealRows(locals.user.id, status, q);
  const qLower = q.toLowerCase();

  const filteredRows = q
    ? baseRows.filter((row: any) => {
        const title = safeDecrypt(row.titleEnc, 'deal.title', '').toLowerCase();
        const description = safeDecrypt(row.descriptionEnc, 'deal.description', '').toLowerCase();
        return title.includes(qLower) || description.includes(qLower);
      })
    : baseRows;

  const deals = await Promise.all(filteredRows.map(mapDealRow));

  const counts = await prisma.deal.groupBy({
    by: ['status'],
    where: { userId: locals.user.id },
    _count: { status: true }
  });

  const summary = {
    total: counts.reduce((sum: number, row: any) => sum + row._count.status, 0),
    open: counts
      .filter((row: any) => row.status !== 'WON' && row.status !== 'LOST')
      .reduce((sum: number, row: any) => sum + row._count.status, 0),
    won: counts.find((row: any) => row.status === 'WON')?._count.status || 0,
    lost: counts.find((row: any) => row.status === 'LOST')?._count.status || 0
  };

  return {
    q,
    selectedStatus: status || '',
    statusOptions: DEAL_STATUSES,
    deals,
    summary
  };
};
