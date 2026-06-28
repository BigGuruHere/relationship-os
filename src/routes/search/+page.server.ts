// src/routes/search/+page.server.ts
// PURPOSE: Perform scoped search across contacts, notes, tags, companies, and deals.
// MULTI TENANT: Every query filters by userId.
// SECURITY: Decrypt only on the server. Never log decrypted PII.

import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decrypt, buildIndexToken } from '$lib/crypto';
import { semanticSearchInteractions } from '$lib/embeddings';
import { dealStatusLabel, formatDealValue, safeDecrypt } from '$lib/deals';

type Scope = 'all' | 'contacts' | 'notes' | 'tags' | 'company' | 'deals';
const LIMIT = 20;

function decryptContactField(value: string | null, aad: string) {
  try {
    return value ? decrypt(value, aad) : '';
  } catch {
    return '';
  }
}

export const load: PageServerLoad = async ({ url, locals }) => {
  if (!locals.user) {
    return { q: '', scope: 'all', results: { contacts: [], notes: [], tags: [], deals: [] } };
  }

  const q = (url.searchParams.get('q') || '').trim();
  const requestedScope = (url.searchParams.get('scope') || 'all') as Scope;
  const scope: Scope = ['all', 'contacts', 'notes', 'tags', 'company', 'deals'].includes(requestedScope)
    ? requestedScope
    : 'all';

  if (!q) return { q: '', scope, results: { contacts: [], notes: [], tags: [], deals: [] } };

  const doContacts = scope === 'all' || scope === 'contacts';
  const doNotes = scope === 'all' || scope === 'notes';
  const doTags = scope === 'all' || scope === 'tags';
  const doCompany = scope === 'company' || scope === 'all' || scope === 'contacts';
  const doDeals = scope === 'all' || scope === 'deals';

  const contacts: Array<{ id: string; name: string; email: string; phone: string; company: string; tags: { name: string }[] }> = [];
  const notes: Array<{ id: string; contactId: string; contactName: string; occurredAt: Date; preview: string }> = [];
  const tags: Array<{ id: string; name: string; contactCount: number }> = [];
  const deals: Array<{ id: string; title: string; statusLabel: string; valueLabel: string; probability: number | null; preview: string }> = [];

  if (doContacts || doCompany) {
    const token = buildIndexToken(q);

    const exactRows: any[] = await prisma.contact.findMany({
      where: {
        userId: locals.user.id,
        OR: [
          ...(doContacts ? [{ fullNameIdx: token }, { emailIdx: token }, { phoneIdx: token }] : []),
          ...(doCompany ? [{ companyIdx: token }] : [])
        ]
      },
      select: {
        id: true,
        fullNameEnc: true,
        emailEnc: true,
        phoneEnc: true,
        companyEnc: true,
        tags: { select: { tag: { select: { name: true } } }, take: 12 }
      },
      take: LIMIT
    });

    const tagRows: any[] = doContacts
      ? await prisma.contact.findMany({
          where: {
            userId: locals.user.id,
            tags: { some: { tag: { name: { contains: q, mode: 'insensitive' } } } }
          },
          select: {
            id: true,
            fullNameEnc: true,
            emailEnc: true,
            phoneEnc: true,
            companyEnc: true,
            tags: { select: { tag: { select: { name: true } } }, take: 12 }
          },
          take: LIMIT
        })
      : [];

    let companyContains: typeof exactRows = [];
    if (doCompany) {
      const sample: any[] = await prisma.contact.findMany({
        where: { userId: locals.user.id },
        select: {
          id: true,
          fullNameEnc: true,
          emailEnc: true,
          phoneEnc: true,
          companyEnc: true,
          tags: { select: { tag: { select: { name: true } } }, take: 12 }
        },
        take: 300
      });

      const qLower = q.toLowerCase();
      companyContains = sample
        .filter((r: any) => decryptContactField(r.companyEnc, 'contact.company').toLowerCase().includes(qLower))
        .slice(0, LIMIT);
    }

    const rows = [...exactRows, ...companyContains, ...tagRows];
    const seen = new Set<string>();

    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);

      contacts.push({
        id: r.id,
        name: decryptContactField(r.fullNameEnc, 'contact.full_name') || '(name unavailable)',
        email: decryptContactField(r.emailEnc, 'contact.email'),
        phone: decryptContactField(r.phoneEnc, 'contact.phone'),
        company: decryptContactField(r.companyEnc, 'contact.company'),
        tags: r.tags.map((ct: any) => ({ name: ct.tag.name }))
      });

      if (contacts.length >= LIMIT) break;
    }
  }

  if (doDeals) {
    const rows: any[] = await prisma.deal.findMany({
      where: { userId: locals.user.id },
      select: {
        id: true,
        titleEnc: true,
        descriptionEnc: true,
        valueCents: true,
        currency: true,
        status: true,
        probability: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 300
    });

    const qLower = q.toLowerCase();
    for (const row of rows) {
      const title = safeDecrypt(row.titleEnc, 'deal.title', 'Untitled deal');
      const description = safeDecrypt(row.descriptionEnc, 'deal.description', '');
      if (!title.toLowerCase().includes(qLower) && !description.toLowerCase().includes(qLower)) continue;

      deals.push({
        id: row.id,
        title,
        statusLabel: dealStatusLabel(row.status),
        valueLabel: formatDealValue(row.valueCents, row.currency),
        probability: row.probability,
        preview: description.length > 180 ? `${description.slice(0, 177)}...` : description
      });

      if (deals.length >= LIMIT) break;
    }
  }

  if (doTags) {
    const tagRows = await prisma.tag.findMany({
      where: {
        userId: locals.user.id,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { aliases: { some: { alias: { contains: q, mode: 'insensitive' } } } }
        ]
      },
      select: { id: true, name: true, _count: { select: { contacts: true } } },
      orderBy: { name: 'asc' },
      take: LIMIT
    });

    for (const t of tagRows) tags.push({ id: t.id, name: t.name, contactCount: t._count.contacts });
  }

  if (doNotes) {
    try {
      const top = await semanticSearchInteractions({ userId: locals.user.id, query: q, topK: LIMIT, minScore: 0.15 });
      const ids = top.map((t) => t.interactionId);

      if (ids.length) {
        const rows: any[] = await prisma.interaction.findMany({
          where: { id: { in: ids }, userId: locals.user.id },
          select: {
            id: true,
            contactId: true,
            occurredAt: true,
            rawTextEnc: true,
            contact: { select: { fullNameEnc: true } }
          }
        });

        const position = new Map(ids.map((id, i) => [id, i]));
        rows.sort((a: any, b: any) => position.get(a.id)! - position.get(b.id)!);

        for (const r of rows) {
          const text = decryptContactField(r.rawTextEnc, 'interaction.raw_text');
          notes.push({
            id: r.id,
            contactId: r.contactId,
            contactName: decryptContactField(r.contact.fullNameEnc, 'contact.full_name') || '(name unavailable)',
            occurredAt: r.occurredAt,
            preview: text.length > 280 ? text.slice(0, 277) + '...' : text
          });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[search] notes retrieval failed -', msg);
    }
  }

  return { q, scope, results: { contacts, notes, tags, deals } };
};
