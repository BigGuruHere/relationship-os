// src/routes/leads/[id]/+page.server.ts
// PURPOSE: View, edit, and convert a single Stage 6 market lead.
// SECURITY: All operations are scoped by userId. PII remains encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt, encrypt } from '$lib/crypto';
import { safeDecrypt } from '$lib/deals';
import { safeDecryptTask } from '$lib/tasks';
import {
  COMMUNICATION_METHODS,
  MARKET_LEAD_SOURCES,
  MARKET_LEAD_STATUSES,
  MARKET_LEAD_TYPES,
  dateToDatetimeLocal
} from '$lib/marketLeads';
import {
  convertLeadToCompany,
  convertLeadToContact,
  convertLeadToDeal,
  convertLeadToExchangeItem,
  leadFormValues,
  mapMarketLead,
  marketLeadCreateData
} from '$lib/server/marketLeads';
import { safeDecryptCompany } from '$lib/companies';

function contactName(row: any) {
  if (!row) return '';
  try { return row.fullNameEnc ? decrypt(row.fullNameEnc, 'contact.full_name') : ''; } catch { return ''; }
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const row = await prisma.marketLead.findFirst({
    where: { id: params.id, userId },
    select: {
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
      descriptionEnc: true,
      notesEnc: true,
      sourceUrlEnc: true,
      nextActionEnc: true,
      nextActionAt: true,
      type: true,
      status: true,
      source: true,
      usualCommunicationMethod: true,
      confidence: true,
      priority: true,
      valueMinCents: true,
      valueMaxCents: true,
      currency: true,
      contactId: true,
      companyId: true,
      dealId: true,
      projectId: true,
      exchangeItemId: true,
      convertedAt: true,
      createdAt: true,
      updatedAt: true,
      contact: { select: { id: true, fullNameEnc: true } },
      company: { select: { id: true, nameEnc: true } },
      deal: { select: { id: true, titleEnc: true } },
      project: { select: { id: true, titleEnc: true } },
      exchangeItem: { select: { id: true, titleEnc: true, type: true } }
    }
  });

  if (!row) throw redirect(303, '/leads');
  const lead = mapMarketLead(row);

  return {
    lead: {
      ...lead,
      nextActionAtInput: dateToDatetimeLocal(lead.nextActionAt),
      valueMin: typeof lead.valueMinCents === 'number' ? (lead.valueMinCents / 100).toFixed(2) : '',
      valueMax: typeof lead.valueMaxCents === 'number' ? (lead.valueMaxCents / 100).toFixed(2) : '',
      linkedContactName: contactName(row.contact),
      linkedCompanyName: row.company ? safeDecryptCompany(row.company.nameEnc, 'company.name', '') : '',
      linkedDealTitle: row.deal ? safeDecrypt(row.deal.titleEnc, 'deal.title', '') : '',
      linkedProjectTitle: row.project ? safeDecryptTask(row.project.titleEnc, 'project.title', '') : '',
      linkedExchangeTitle: row.exchangeItem ? safeDecrypt(row.exchangeItem.titleEnc, 'exchange.title', '') : ''
    },
    leadTypes: MARKET_LEAD_TYPES,
    leadStatuses: MARKET_LEAD_STATUSES,
    leadSources: MARKET_LEAD_SOURCES,
    communicationMethods: COMMUNICATION_METHODS
  };
};

export const actions: Actions = {
  update: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const existing = await prisma.marketLead.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!existing) return fail(404, { error: 'Lead not found.' });

    const values = leadFormValues(await request.formData());
    if (!values.title && !values.name && !values.companyName) return fail(400, { error: 'Add a title, person name, or company name.' });

    const data: any = marketLeadCreateData(userId, values);
    delete data.userId;
    // IT: editing text/status fields should not unlink already converted records.
    delete data.contactId;
    delete data.companyId;
    delete data.dealId;
    delete data.projectId;
    await prisma.marketLead.updateMany({ where: { id: params.id, userId }, data });
    throw redirect(303, `/leads/${params.id}`);
  },

  convertToContact: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const contactId = await convertLeadToContact(locals.user.id, params.id);
      throw redirect(303, `/contacts/${contactId}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not convert lead to contact.' });
    }
  },

  convertToCompany: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const companyId = await convertLeadToCompany(locals.user.id, params.id);
      throw redirect(303, `/companies/${companyId}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not convert lead to company.' });
    }
  },

  convertToDeal: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const dealId = await convertLeadToDeal(locals.user.id, params.id);
      throw redirect(303, `/deals/${dealId}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not convert lead to deal.' });
    }
  },

  convertToWant: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const exchangeId = await convertLeadToExchangeItem(locals.user.id, params.id, 'WANT');
      throw redirect(303, `/leads/${params.id}?converted=want&exchangeItemId=${exchangeId}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not convert lead to want.' });
    }
  },

  convertToOffer: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const exchangeId = await convertLeadToExchangeItem(locals.user.id, params.id, 'OFFER');
      throw redirect(303, `/leads/${params.id}?converted=offer&exchangeItemId=${exchangeId}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not convert lead to offer.' });
    }
  },

  archive: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    await prisma.marketLead.updateMany({ where: { id: params.id, userId: locals.user.id }, data: { status: 'ARCHIVED' as any } });
    throw redirect(303, '/leads');
  }
};
