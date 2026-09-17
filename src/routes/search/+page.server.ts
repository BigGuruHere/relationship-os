// src/routes/search/+page.server.ts
// PURPOSE: Perform scoped search across contacts, lead records/notes, notes, tags, companies, and deals.
// MULTI TENANT: Every query filters by userId.
// SECURITY: Decrypt only on the server. Never log decrypted PII.

import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decrypt, buildIndexToken } from '$lib/crypto';
import { semanticSearchInteractions } from '$lib/embeddings';
import { companyKindLabel, companyStatusLabel, safeDecryptCompany } from '$lib/companies';
import { dealStatusLabel, formatDealValue, safeDecrypt } from '$lib/deals';
import { marketLeadSourceLabel, marketLeadStatusLabel, marketLeadTypeLabel, safeDecryptLead } from '$lib/marketLeads';
import { contextSpaceIdForOwner } from '$lib/server/core/contextSpace';

type Scope = 'all' | 'contacts' | 'leads' | 'notes' | 'tags' | 'company' | 'deals';

function phoneDigits(value: string) {
  return value.replace(/\D/g, '');
}
const LIMIT = 20;
const LEAD_SCAN_BATCH = 250;
const LEAD_SCAN_LIMIT = 5000;
const LEAD_NOTE_SCAN_BATCH = 500;
const LEAD_NOTE_SCAN_LIMIT = 5000;

function previewText(value: string, max = 240) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}

function decryptContactField(value: string | null, aad: string) {
  try {
    return value ? decrypt(value, aad) : '';
  } catch {
    return '';
  }
}

// IT: Project/workstream labels use the same encrypted payload format; keep failures non-fatal in search.
function safeDecryptTaskSearch(value: string | null | undefined, aad: string) {
  try {
    return value ? decrypt(value, aad) : '';
  } catch {
    return '';
  }
}

export const load: PageServerLoad = async ({ url, locals }) => {
  if (!locals.user) {
    return { q: '', scope: 'all', results: { contacts: [], leads: [], leadNotes: [], notes: [], tags: [], companies: [], deals: [] } };
  }

  const q = (url.searchParams.get('q') || '').trim();
  const requestedScope = (url.searchParams.get('scope') || 'all') as Scope;
  const scope: Scope = ['all', 'contacts', 'leads', 'notes', 'tags', 'company', 'deals'].includes(requestedScope)
    ? requestedScope
    : 'all';

  if (!q) return { q: '', scope, results: { contacts: [], leads: [], leadNotes: [], notes: [], tags: [], companies: [], deals: [] } };

  const doContacts = scope === 'all' || scope === 'contacts';
  const doLeads = scope === 'all' || scope === 'leads';
  const doNotes = scope === 'all' || scope === 'notes';
  const doTags = scope === 'all' || scope === 'tags';
  const doCompany = scope === 'company' || scope === 'all' || scope === 'contacts';
  const doDeals = scope === 'all' || scope === 'deals';

  const contacts: Array<{ id: string; name: string; email: string; phone: string; company: string; tags: { name: string }[] }> = [];
  const leads: Array<{ id: string; title: string; name: string; companyName: string; email: string; phone: string; typeLabel: string; statusLabel: string; sourceLabel: string; preview: string; matchedInNote: boolean }> = [];
  const leadNotes: Array<{ id: string; marketLeadId: string; leadTitle: string; occurredAt: Date; channel: string; preview: string }> = [];
  const notes: Array<{ id: string; contactId: string; contactName: string; occurredAt: Date; preview: string }> = [];
  const tags: Array<{ id: string; name: string; contactCount: number; companyCount: number }> = [];
  const companies: Array<{ id: string; name: string; kindLabel: string; statusLabel: string; website: string; phone: string; tags: { name: string }[]; preview: string }> = [];
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

    let containsRows: typeof exactRows = [];
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
      take: 500
    });

    const qLower = q.toLowerCase();
    const qDigits = phoneDigits(q);
    containsRows = sample
      .filter((r: any) => {
        const values = [
          decryptContactField(r.fullNameEnc, 'contact.full_name'),
          decryptContactField(r.emailEnc, 'contact.email'),
          decryptContactField(r.companyEnc, 'contact.company'),
          ...(r.tags || []).map((ct: any) => ct.tag.name)
        ];
        const textHit = values.join(' ').toLowerCase().includes(qLower);
        const phoneHit = qDigits.length >= 3 && phoneDigits(decryptContactField(r.phoneEnc, 'contact.phone')).includes(qDigits);
        return textHit || phoneHit;
      })
      .slice(0, LIMIT);

    const rows = [...exactRows, ...containsRows, ...tagRows];
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


  if (doLeads) {
    const userId = locals.user.id;
    const contextSpaceId = contextSpaceIdForOwner(userId);
    const token = buildIndexToken(q);
    const qLower = q.toLowerCase();
    const qDigits = phoneDigits(q);

    // IT: Lead text is encrypted, so global search combines deterministic exact indexes with a
    // custody-scoped bounded decrypt scan for partial matches. Never scan outside this ContextSpace.
    const leadSelect = {
      id: true,
      titleEnc: true,
      nameEnc: true,
      companyNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      websiteEnc: true,
      linkedinEnc: true,
      roleTitleEnc: true,
      geographyEnc: true,
      addressEnc: true,
      descriptionEnc: true,
      notesEnc: true,
      nextActionEnc: true,
      type: true,
      status: true,
      source: true,
      updatedAt: true,
      leadSource: { select: { nameEnc: true } },
      company: { select: { nameEnc: true } },
      contact: { select: { fullNameEnc: true } },
      project: { select: { titleEnc: true } },
      workstream: { select: { nameEnc: true } }
    } as const;

    const seenLeadIds = new Set<string>();

    const addLeadResult = (row: any, matchedNote = '') => {
      if (seenLeadIds.has(row.id) || leads.length >= LIMIT) return;

      const title = safeDecryptLead(row.titleEnc, 'market_lead.title', 'Untitled lead');
      const name = safeDecryptLead(row.nameEnc, 'market_lead.name', '');
      const companyName = safeDecryptLead(row.companyNameEnc, 'market_lead.company_name', '');
      const email = safeDecryptLead(row.emailEnc, 'market_lead.email', '');
      const phone = safeDecryptLead(row.phoneEnc, 'market_lead.phone', '');
      const description = safeDecryptLead(row.descriptionEnc, 'market_lead.description', '');
      const notesText = safeDecryptLead(row.notesEnc, 'market_lead.notes', '');
      const nextAction = safeDecryptLead(row.nextActionEnc, 'market_lead.next_action', '');
      const sourceLabel = row.leadSource
        ? safeDecryptLead(row.leadSource.nameEnc, 'lead_source.name', marketLeadSourceLabel(row.source))
        : marketLeadSourceLabel(row.source);

      let preview = matchedNote ? `Lead note: ${previewText(matchedNote)}` : '';
      if (!preview) {
        const richText = [notesText, description, nextAction].find((value) => value && value.toLowerCase().includes(qLower));
        if (richText) preview = previewText(richText);
      }

      seenLeadIds.add(row.id);
      leads.push({
        id: row.id,
        title,
        name,
        companyName,
        email,
        phone,
        typeLabel: marketLeadTypeLabel(row.type),
        statusLabel: marketLeadStatusLabel(row.status),
        sourceLabel,
        preview,
        matchedInNote: !!matchedNote
      });
    };

    const leadMatches = (row: any) => {
      const phone = safeDecryptLead(row.phoneEnc, 'market_lead.phone', '');
      const values = [
        safeDecryptLead(row.titleEnc, 'market_lead.title', ''),
        safeDecryptLead(row.nameEnc, 'market_lead.name', ''),
        safeDecryptLead(row.companyNameEnc, 'market_lead.company_name', ''),
        safeDecryptLead(row.emailEnc, 'market_lead.email', ''),
        safeDecryptLead(row.websiteEnc, 'market_lead.website', ''),
        safeDecryptLead(row.linkedinEnc, 'market_lead.linkedin', ''),
        safeDecryptLead(row.roleTitleEnc, 'market_lead.role_title', ''),
        safeDecryptLead(row.geographyEnc, 'market_lead.geography', ''),
        safeDecryptLead(row.addressEnc, 'market_lead.address', ''),
        safeDecryptLead(row.descriptionEnc, 'market_lead.description', ''),
        safeDecryptLead(row.notesEnc, 'market_lead.notes', ''),
        safeDecryptLead(row.nextActionEnc, 'market_lead.next_action', ''),
        row.leadSource ? safeDecryptLead(row.leadSource.nameEnc, 'lead_source.name', '') : marketLeadSourceLabel(row.source),
        row.company ? safeDecryptCompany(row.company.nameEnc, 'company.name', '') : '',
        row.contact ? decryptContactField(row.contact.fullNameEnc, 'contact.full_name') : '',
        row.project ? safeDecryptTaskSearch(row.project.titleEnc, 'project.title') : '',
        row.workstream ? safeDecryptTaskSearch(row.workstream.nameEnc, 'project_workstream.name') : '',
        marketLeadTypeLabel(row.type),
        marketLeadStatusLabel(row.status),
        marketLeadSourceLabel(row.source)
      ];
      const textHit = values.join(' ').toLowerCase().includes(qLower);
      const phoneHit = qDigits.length >= 3 && phoneDigits(phone).includes(qDigits);
      return textHit || phoneHit;
    };

    const exactRows: any[] = await prisma.marketLead.findMany({
      where: {
        userId,
        contextSpaceId,
        OR: [
          { titleIdx: token },
          { nameIdx: token },
          { companyNameIdx: token },
          { emailIdx: token },
          { phoneIdx: token },
          { websiteIdx: token },
          { linkedinIdx: token },
          { addressIdx: token }
        ]
      },
      select: leadSelect,
      orderBy: { updatedAt: 'desc' },
      take: LIMIT
    });
    for (const row of exactRows) addLeadResult(row);

    // IT: Partial lead-name/company/note-field matching cannot use equality HMAC indexes. Scan in
    // bounded batches so the main search can still find partial encrypted values at current CRM scale.
    for (let skip = 0; skip < LEAD_SCAN_LIMIT && leads.length < LIMIT; skip += LEAD_SCAN_BATCH) {
      const rows: any[] = await prisma.marketLead.findMany({
        where: { userId, contextSpaceId },
        select: leadSelect,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: LEAD_SCAN_BATCH
      });
      for (const row of rows) {
        if (!seenLeadIds.has(row.id) && leadMatches(row)) addLeadResult(row);
        if (leads.length >= LIMIT) break;
      }
      if (rows.length < LEAD_SCAN_BATCH) break;
    }

    // IT: MarketLeadNote is separate from MarketLead.notesEnc. Include those time-stamped working
    // notes so research, call notes and LinkedIn notes are discoverable from the main Search page.
    const noteMatches = new Map<string, string>();
    for (let skip = 0; skip < LEAD_NOTE_SCAN_LIMIT && leads.length + noteMatches.size < LIMIT; skip += LEAD_NOTE_SCAN_BATCH) {
      const rows: any[] = await prisma.marketLeadNote.findMany({
        where: { userId, contextSpaceId },
        select: { marketLeadId: true, bodyEnc: true, summaryEnc: true },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: LEAD_NOTE_SCAN_BATCH
      });
      for (const row of rows) {
        if (seenLeadIds.has(row.marketLeadId) || noteMatches.has(row.marketLeadId)) continue;
        const body = safeDecryptLead(row.bodyEnc, 'market_lead_note.body', '');
        const summary = safeDecryptLead(row.summaryEnc, 'market_lead_note.summary', '');
        const matchText = [summary, body].find((value) => value && value.toLowerCase().includes(qLower));
        if (matchText) noteMatches.set(row.marketLeadId, matchText);
        if (leads.length + noteMatches.size >= LIMIT) break;
      }
      if (rows.length < LEAD_NOTE_SCAN_BATCH) break;
    }

    if (noteMatches.size && leads.length < LIMIT) {
      const rows: any[] = await prisma.marketLead.findMany({
        where: { userId, contextSpaceId, id: { in: [...noteMatches.keys()] } },
        select: leadSelect
      });
      const byId = new Map(rows.map((row: any) => [row.id, row]));
      for (const [leadId, noteText] of noteMatches) {
        const row = byId.get(leadId);
        if (row) addLeadResult(row, noteText);
        if (leads.length >= LIMIT) break;
      }
    }
  }

  if (doCompany) {
    const companyRows: any[] = await prisma.company.findMany({
      where: { userId: locals.user.id },
      select: {
        id: true,
        nameEnc: true,
        websiteEnc: true,
        phoneEnc: true,
        industryEnc: true,
        descriptionEnc: true,
        criteriaEnc: true,
        notesEnc: true,
        kind: true,
        status: true,
        tags: { select: { tag: { select: { name: true } } }, take: 12 }
      },
      orderBy: { updatedAt: 'desc' },
      take: 300
    });

    const qLower = q.toLowerCase();
    const qDigits = phoneDigits(q);
    for (const row of companyRows) {
      const name = safeDecryptCompany(row.nameEnc, 'company.name', 'Untitled company');
      const website = safeDecryptCompany(row.websiteEnc, 'company.website', '');
      const phone = safeDecryptCompany(row.phoneEnc, 'company.phone', '');
      const industry = safeDecryptCompany(row.industryEnc, 'company.industry', '');
      const description = safeDecryptCompany(row.descriptionEnc, 'company.description', '');
      const criteria = safeDecryptCompany(row.criteriaEnc, 'company.criteria', '');
      const notesText = safeDecryptCompany(row.notesEnc, 'company.notes', '');
      const companyTags = (row.tags || []).map((ct: any) => ({ name: ct.tag.name }));
      const searchable = [name, website, phone, industry, description, criteria, notesText, ...companyTags.map((t: any) => t.name)].join(' ').toLowerCase();
      const phoneHit = qDigits.length >= 3 && phoneDigits(phone).includes(qDigits);
      if (!searchable.includes(qLower) && !phoneHit) continue;

      companies.push({
        id: row.id,
        name,
        kindLabel: companyKindLabel(row.kind),
        statusLabel: companyStatusLabel(row.status),
        website,
        phone,
        tags: companyTags,
        preview: description.length > 180 ? `${description.slice(0, 177)}...` : description
      });

      if (companies.length >= LIMIT) break;
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
      select: { id: true, name: true, _count: { select: { contacts: true, companies: true } } },
      orderBy: { name: 'asc' },
      take: LIMIT
    });

    for (const t of tagRows) tags.push({ id: t.id, name: t.name, contactCount: t._count.contacts, companyCount: t._count.companies });
  }

  if (doNotes) {
    try {
      const top = await semanticSearchInteractions({ userId: locals.user.id, query: q, topK: LIMIT, minScore: 0.15 });
      const ids = top.map((t) => t.interactionId);

      if (ids.length) {
        const rows: any[] = await prisma.interaction.findMany({
          where: { id: { in: ids }, userId: locals.user.id, contactId: { not: null } },
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


  // IT: The Notes scope predates MarketLeadNote. Search lead notes here as first-class note results
  // so the global Notes filter does not silently exclude lead research/call/LinkedIn history.
  if (scope === 'notes') {
    const userId = locals.user.id;
    const contextSpaceId = contextSpaceIdForOwner(userId);
    const qLower = q.toLowerCase();

    for (let skip = 0; skip < LEAD_NOTE_SCAN_LIMIT && leadNotes.length < LIMIT; skip += LEAD_NOTE_SCAN_BATCH) {
      const rows: any[] = await prisma.marketLeadNote.findMany({
        where: { userId, contextSpaceId },
        select: {
          id: true,
          marketLeadId: true,
          occurredAt: true,
          channel: true,
          bodyEnc: true,
          summaryEnc: true,
          marketLead: { select: { titleEnc: true } }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: LEAD_NOTE_SCAN_BATCH
      });

      for (const row of rows) {
        const body = safeDecryptLead(row.bodyEnc, 'market_lead_note.body', '');
        const summary = safeDecryptLead(row.summaryEnc, 'market_lead_note.summary', '');
        const matchText = [summary, body].find((value) => value && value.toLowerCase().includes(qLower));
        if (!matchText) continue;
        leadNotes.push({
          id: row.id,
          marketLeadId: row.marketLeadId,
          leadTitle: safeDecryptLead(row.marketLead?.titleEnc, 'market_lead.title', 'Untitled lead'),
          occurredAt: row.occurredAt,
          channel: row.channel || 'note',
          preview: previewText(matchText, 280)
        });
        if (leadNotes.length >= LIMIT) break;
      }
      if (rows.length < LEAD_NOTE_SCAN_BATCH) break;
    }
  }

  return { q, scope, results: { contacts, leads, leadNotes, notes, tags, companies, deals } };
};
