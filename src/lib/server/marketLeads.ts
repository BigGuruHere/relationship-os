// src/lib/server/marketLeads.ts
// PURPOSE: Server-side helpers for Stage 6 Market Leads and conversion flows.
// SECURITY: All caller queries must pass tenant userId. PII is encrypted at rest.

import { prisma } from '$lib/db';
import { buildIndexToken, decrypt, encrypt } from '$lib/crypto';
import { parseMoneyToCents } from '$lib/deals';
import {
  MARKET_LEAD_SOURCES,
  clampInt,
  communicationMethodLabel,
  buyerQualificationStatusLabel,
  contactAttemptStatusLabel,
  marketLeadSourceLabel,
  marketLeadStatusLabel,
  marketLeadTypeLabel,
  normaliseCommunicationMethod,
  normaliseBuyerQualificationStatus,
  normaliseContactAttemptStatus,
  normaliseMarketLeadSource,
  normaliseMarketLeadStatus,
  normaliseMarketLeadType,
  normaliseSellerQualificationStatus,
  sellerQualificationStatusLabel,
  parseDateTime,
  safeDecryptLead
} from '$lib/marketLeads';

export type MarketLeadFormValues = {
  title: string;
  type: string;
  status: string;
  source: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  roleTitle: string;
  geography: string;
  address: string;
  description: string;
  notes: string;
  sourceUrl: string;
  sourceChoice: string;
  leadSourceId: string;
  newLeadSource: string;
  usualCommunicationMethod: string;
  contactAttemptStatus: string;
  lastContactedAt: string;
  buyerStatus: string;
  sellerStatus: string;
  confidence: number;
  priority: number;
  valueMin: string;
  valueMax: string;
  currency: string;
  nextAction: string;
  nextActionAt: string;
  contactId: string;
  companyId: string;
  dealId: string;
  projectId: string;
};

export function normaliseUrl(input: string) {
  const raw = input.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.replace(/^http:\/\//i, 'https://'));
    url.hash = '';
    return url.toString();
  } catch {
    return raw;
  }
}

export function leadFormValues(form: FormData, defaults: Partial<MarketLeadFormValues> = {}): MarketLeadFormValues {
  const rawSourceChoice = String(form.get('sourceChoice') || defaults.sourceChoice || '').trim();
  let source = String(form.get('source') || defaults.source || 'MANUAL').trim().toUpperCase();
  let leadSourceId = String(form.get('leadSourceId') || defaults.leadSourceId || '').trim();
  let newLeadSource = String(form.get('newLeadSource') || defaults.newLeadSource || '').trim();

  if (rawSourceChoice.startsWith('builtin:')) {
    source = rawSourceChoice.slice('builtin:'.length).trim().toUpperCase() || 'MANUAL';
    leadSourceId = '';
    newLeadSource = '';
  } else if (rawSourceChoice.startsWith('custom:')) {
    source = 'OTHER';
    leadSourceId = rawSourceChoice.slice('custom:'.length).trim();
    newLeadSource = '';
  } else if (rawSourceChoice === 'CUSTOM') {
    source = 'OTHER';
    leadSourceId = '';
  }

  return {
    title: String(form.get('title') || defaults.title || '').trim(),
    type: String(form.get('type') || defaults.type || 'OTHER').trim().toUpperCase(),
    status: String(form.get('status') || defaults.status || 'NEW').trim().toUpperCase(),
    source,
    name: String(form.get('name') || defaults.name || '').trim(),
    companyName: String(form.get('companyName') || defaults.companyName || '').trim(),
    email: String(form.get('email') || defaults.email || '').trim(),
    phone: String(form.get('phone') || defaults.phone || '').trim(),
    website: normaliseUrl(String(form.get('website') || defaults.website || '').trim()),
    linkedin: normaliseUrl(String(form.get('linkedin') || defaults.linkedin || '').trim()),
    roleTitle: String(form.get('roleTitle') || defaults.roleTitle || '').trim(),
    geography: String(form.get('geography') || defaults.geography || '').trim(),
    address: String(form.get('address') || form.get('addressLine1') || defaults.address || '').trim(),
    description: String(form.get('description') || defaults.description || '').trim(),
    notes: String(form.get('notes') || defaults.notes || '').trim(),
    sourceUrl: normaliseUrl(String(form.get('sourceUrl') || defaults.sourceUrl || '').trim()),
    sourceChoice: rawSourceChoice,
    leadSourceId,
    newLeadSource,
    usualCommunicationMethod: String(form.get('usualCommunicationMethod') || defaults.usualCommunicationMethod || '').trim().toUpperCase(),
    contactAttemptStatus: String(form.get('contactAttemptStatus') || defaults.contactAttemptStatus || 'NOT_CONTACTED').trim().toUpperCase(),
    lastContactedAt: String(form.get('lastContactedAt') || defaults.lastContactedAt || '').trim(),
    buyerStatus: String(form.get('buyerStatus') || defaults.buyerStatus || 'NOT_ASKED').trim().toUpperCase(),
    sellerStatus: String(form.get('sellerStatus') || defaults.sellerStatus || 'NOT_ASKED').trim().toUpperCase(),
    confidence: clampInt(form.get('confidence'), defaults.confidence ?? 50, 0, 100),
    priority: clampInt(form.get('priority'), defaults.priority ?? 3, 1, 5),
    valueMin: String(form.get('valueMin') || defaults.valueMin || '').trim(),
    valueMax: String(form.get('valueMax') || defaults.valueMax || '').trim(),
    currency: String(form.get('currency') || defaults.currency || 'AUD').trim().toUpperCase() || 'AUD',
    nextAction: String(form.get('nextAction') || defaults.nextAction || '').trim(),
    nextActionAt: String(form.get('nextActionAt') || defaults.nextActionAt || '').trim(),
    contactId: String(form.get('contactId') || defaults.contactId || '').trim(),
    companyId: String(form.get('companyId') || defaults.companyId || '').trim(),
    dealId: String(form.get('dealId') || defaults.dealId || '').trim(),
    projectId: String(form.get('projectId') || defaults.projectId || '').trim()
  };
}

function optionalEncrypted(value: string, aad: string) {
  return value ? encrypt(value, aad) : null;
}

function optionalIdx(value: string) {
  return value ? buildIndexToken(value) : null;
}

export function marketLeadCreateData(userId: string, values: MarketLeadFormValues) {
  const title = values.title || values.name || values.companyName || 'Untitled lead';
  return {
    userId,
    type: normaliseMarketLeadType(values.type) as any,
    status: normaliseMarketLeadStatus(values.status) as any,
    source: normaliseMarketLeadSource(values.source) as any,
    leadSourceId: values.leadSourceId || null,
    titleEnc: encrypt(title, 'market_lead.title'),
    titleIdx: buildIndexToken(title),
    nameEnc: optionalEncrypted(values.name, 'market_lead.name'),
    nameIdx: optionalIdx(values.name),
    companyNameEnc: optionalEncrypted(values.companyName, 'market_lead.company_name'),
    companyNameIdx: optionalIdx(values.companyName),
    emailEnc: optionalEncrypted(values.email, 'market_lead.email'),
    emailIdx: optionalIdx(values.email),
    phoneEnc: optionalEncrypted(values.phone, 'market_lead.phone'),
    phoneIdx: optionalIdx(values.phone),
    websiteEnc: optionalEncrypted(values.website, 'market_lead.website'),
    websiteIdx: optionalIdx(values.website),
    linkedinEnc: optionalEncrypted(values.linkedin, 'market_lead.linkedin'),
    linkedinIdx: optionalIdx(values.linkedin),
    roleTitleEnc: optionalEncrypted(values.roleTitle, 'market_lead.role_title'),
    geographyEnc: optionalEncrypted(values.geography, 'market_lead.geography'),
    addressEnc: optionalEncrypted(values.address, 'market_lead.address'),
    addressIdx: optionalIdx(values.address),
    descriptionEnc: optionalEncrypted(values.description, 'market_lead.description'),
    notesEnc: optionalEncrypted(values.notes, 'market_lead.notes'),
    sourceUrlEnc: optionalEncrypted(values.sourceUrl, 'market_lead.source_url'),
    usualCommunicationMethod: normaliseCommunicationMethod(values.usualCommunicationMethod) as any,
    contactAttemptStatus: normaliseContactAttemptStatus(values.contactAttemptStatus),
    lastContactedAt: parseDateTime(values.lastContactedAt),
    buyerStatus: normaliseBuyerQualificationStatus(values.buyerStatus),
    sellerStatus: normaliseSellerQualificationStatus(values.sellerStatus),
    confidence: Math.min(100, Math.max(0, values.confidence)),
    priority: Math.min(5, Math.max(1, values.priority)),
    valueMinCents: parseMoneyToCents(values.valueMin),
    valueMaxCents: parseMoneyToCents(values.valueMax),
    currency: values.currency || 'AUD',
    nextActionEnc: optionalEncrypted(values.nextAction, 'market_lead.next_action'),
    nextActionAt: parseDateTime(values.nextActionAt),
    contactId: values.contactId || null,
    companyId: values.companyId || null,
    dealId: values.dealId || null,
    projectId: values.projectId || null
  };
}

export function mapMarketLead(row: any) {
  const title = safeDecryptLead(row.titleEnc, 'market_lead.title', 'Untitled lead');
  const name = safeDecryptLead(row.nameEnc, 'market_lead.name', '');
  const companyName = safeDecryptLead(row.companyNameEnc, 'market_lead.company_name', '');
  const email = safeDecryptLead(row.emailEnc, 'market_lead.email', '');
  const phone = safeDecryptLead(row.phoneEnc, 'market_lead.phone', '');
  const website = safeDecryptLead(row.websiteEnc, 'market_lead.website', '');
  const linkedin = safeDecryptLead(row.linkedinEnc, 'market_lead.linkedin', '');
  const roleTitle = safeDecryptLead(row.roleTitleEnc, 'market_lead.role_title', '');
  const geography = safeDecryptLead(row.geographyEnc, 'market_lead.geography', '');
  const address = safeDecryptLead(row.addressEnc, 'market_lead.address', '');
  const description = safeDecryptLead(row.descriptionEnc, 'market_lead.description', '');
  const notes = safeDecryptLead(row.notesEnc, 'market_lead.notes', '');
  const sourceUrl = safeDecryptLead(row.sourceUrlEnc, 'market_lead.source_url', '');
  const nextAction = safeDecryptLead(row.nextActionEnc, 'market_lead.next_action', '');
  return {
    id: row.id,
    title,
    name,
    companyName,
    email,
    phone,
    website,
    linkedin,
    roleTitle,
    geography,
    address,
    description,
    descriptionPreview: description.length > 180 ? `${description.slice(0, 177)}...` : description,
    notes,
    sourceUrl,
    nextAction,
    nextActionAt: row.nextActionAt,
    type: row.type,
    typeLabel: marketLeadTypeLabel(row.type),
    status: row.status,
    statusLabel: marketLeadStatusLabel(row.status),
    source: row.source,
    sourceLabel: row.leadSource ? safeDecryptLead(row.leadSource.nameEnc, 'lead_source.name', marketLeadSourceLabel(row.source)) : marketLeadSourceLabel(row.source),
    sourceCategoryLabel: marketLeadSourceLabel(row.source),
    sourceChoice: row.leadSourceId ? `custom:${row.leadSourceId}` : `builtin:${row.source || 'MANUAL'}`,
    leadSourceId: row.leadSourceId,
    usualCommunicationMethod: row.usualCommunicationMethod,
    usualCommunicationMethodLabel: communicationMethodLabel(row.usualCommunicationMethod),
    contactAttemptStatus: row.contactAttemptStatus || 'NOT_CONTACTED',
    contactAttemptStatusLabel: contactAttemptStatusLabel(row.contactAttemptStatus),
    lastContactedAt: row.lastContactedAt,
    buyerStatus: row.buyerStatus || 'NOT_ASKED',
    buyerStatusLabel: buyerQualificationStatusLabel(row.buyerStatus),
    sellerStatus: row.sellerStatus || 'NOT_ASKED',
    sellerStatusLabel: sellerQualificationStatusLabel(row.sellerStatus),
    confidence: row.confidence,
    priority: row.priority,
    valueMinCents: row.valueMinCents,
    valueMaxCents: row.valueMaxCents,
    currency: row.currency || 'AUD',
    contactId: row.contactId,
    companyId: row.companyId,
    dealId: row.dealId,
    projectId: row.projectId,
    exchangeItemId: row.exchangeItemId,
    convertedAt: row.convertedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    contact: row.contact,
    company: row.company,
    deal: row.deal,
    project: row.project,
    exchangeItem: row.exchangeItem
  };
}

export async function resolveLeadSourceId(userId: string, leadSourceId: string, newLeadSource: string) {
  const id = String(leadSourceId || '').trim();
  if (id) {
    const existing = await prisma.leadSource.findFirst({ where: { id, userId }, select: { id: true } });
    return existing?.id || null;
  }
  const name = String(newLeadSource || '').trim();
  if (!name) return null;
  const nameIdx = buildIndexToken(name);
  const row = await prisma.leadSource.upsert({
    where: { userId_nameIdx: { userId, nameIdx } },
    update: { nameEnc: encrypt(name, 'lead_source.name') },
    create: { userId, nameEnc: encrypt(name, 'lead_source.name'), nameIdx },
    select: { id: true }
  });
  return row.id;
}

export async function loadLeadSources(userId: string) {
  const rows = await prisma.leadSource.findMany({
    where: { userId },
    select: { id: true, nameEnc: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 200
  });
  return rows.map((source: any) => ({
    id: source.id,
    name: safeDecryptLead(source.nameEnc, 'lead_source.name', 'Untitled source'),
    updatedAt: source.updatedAt
  })).sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export function buildLeadSourceOptions(customSources: Array<{ id: string; name: string }>) {
  const builtin = MARKET_LEAD_SOURCES.map((source) => ({
    value: `builtin:${source.value}`,
    label: source.label,
    kind: 'builtin' as const,
    source: source.value,
    id: ''
  }));
  const custom = customSources.map((source) => ({
    value: `custom:${source.id}`,
    label: source.name,
    kind: 'custom' as const,
    source: 'OTHER',
    id: source.id
  }));
  return [...builtin, ...custom, { value: 'CUSTOM', label: 'Custom...', kind: 'custom_new' as const, source: 'OTHER', id: '' }];
}

export function normaliseLeadSourceChoice(choice: string) {
  const raw = String(choice || '').trim();
  if (raw.startsWith('custom:')) return { kind: 'custom' as const, id: raw.slice('custom:'.length) };
  if (raw.startsWith('builtin:')) return { kind: 'builtin' as const, source: raw.slice('builtin:'.length).trim().toUpperCase() || 'MANUAL' };
  return { kind: 'none' as const };
}

export function decryptContactField(payload: string | null | undefined, aad: string) {
  if (!payload) return '';
  try { return decrypt(payload, aad); } catch { return ''; }
}

function contactSourceChoice(row: { source?: string | null; leadSourceId?: string | null }) {
  return row.leadSourceId ? `custom:${row.leadSourceId}` : `builtin:${row.source || 'MANUAL'}`;
}

function leadToContactUpdateData(display: any, lead: any, existingContact: any = null) {
  // IT: Copy only the fields that should live on the ongoing relationship record.
  // Existing contact values are preserved unless they are blank/default, so a conversion
  // does not accidentally overwrite cleaner contact truth.
  const data: any = {};
  const currentAddress = existingContact ? decryptContactField(existingContact.addressEnc, 'contact.address') : '';

  if (display.address && (!existingContact || !currentAddress)) {
    data.addressEnc = encrypt(display.address, 'contact.address');
    data.addressIdx = buildIndexToken(display.address);
  }

  if (display.usualCommunicationMethod && (!existingContact || !existingContact.usualCommunicationMethod)) {
    data.usualCommunicationMethod = display.usualCommunicationMethod;
  }

  if (lead.source && (!existingContact || !existingContact.source || existingContact.source === 'MANUAL')) {
    data.source = lead.source;
  }
  if (lead.leadSourceId && (!existingContact || !existingContact.leadSourceId)) {
    data.leadSourceId = lead.leadSourceId;
    data.source = 'OTHER';
  }

  const leadAttempt = display.contactAttemptStatus || 'NOT_CONTACTED';
  if (leadAttempt !== 'NOT_CONTACTED' && (!existingContact || !existingContact.contactAttemptStatus || existingContact.contactAttemptStatus === 'NOT_CONTACTED')) {
    data.contactAttemptStatus = leadAttempt;
  }

  if (lead.lastContactedAt && (!existingContact || !existingContact.lastContactedAt || new Date(lead.lastContactedAt) > new Date(existingContact.lastContactedAt))) {
    data.lastContactedAt = lead.lastContactedAt;
  }

  const leadBuyer = display.buyerStatus || 'NOT_ASKED';
  if (leadBuyer !== 'NOT_ASKED' && (!existingContact || !existingContact.buyerStatus || existingContact.buyerStatus === 'NOT_ASKED')) {
    data.buyerStatus = leadBuyer;
  }

  const leadSeller = display.sellerStatus || 'NOT_ASKED';
  if (leadSeller !== 'NOT_ASKED' && (!existingContact || !existingContact.sellerStatus || existingContact.sellerStatus === 'NOT_ASKED')) {
    data.sellerStatus = leadSeller;
  }

  return data;
}

export async function createLeadFromContact(userId: string, contactId: string, form: FormData) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, companyEnc: true, positionEnc: true, linkedinEnc: true, usualCommunicationMethod: true, addressEnc: true, source: true, leadSourceId: true, contactAttemptStatus: true, lastContactedAt: true, buyerStatus: true, sellerStatus: true }
  });
  if (!contact) throw new Error('Contact not found.');

  const name = decryptContactField(contact.fullNameEnc, 'contact.full_name') || 'Untitled contact';
  const email = decryptContactField(contact.emailEnc, 'contact.email');
  const phone = decryptContactField(contact.phoneEnc, 'contact.phone');
  const companyName = decryptContactField(contact.companyEnc, 'contact.company');
  const roleTitle = decryptContactField(contact.positionEnc, 'contact.position');
  const linkedin = decryptContactField(contact.linkedinEnc, 'contact.linkedin');
  const address = decryptContactField(contact.addressEnc, 'contact.address');

  const values = leadFormValues(form, {
    title: name,
    name,
    email,
    phone,
    companyName,
    roleTitle,
    linkedin,
    type: 'CONTACT',
    source: contact.source || 'MANUAL',
    leadSourceId: contact.leadSourceId || '',
    address,
    usualCommunicationMethod: contact.usualCommunicationMethod || '',
    contactAttemptStatus: contact.contactAttemptStatus || 'NOT_CONTACTED',
    lastContactedAt: contact.lastContactedAt ? new Date(contact.lastContactedAt).toISOString().slice(0, 16) : '',
    buyerStatus: contact.buyerStatus || 'NOT_ASKED',
    sellerStatus: contact.sellerStatus || 'NOT_ASKED'
  });

  const row = await prisma.marketLead.create({ data: { ...marketLeadCreateData(userId, values), contactId } as any, select: { id: true } });
  return row.id;
}

export async function convertLeadToContact(userId: string, leadId: string) {
  const lead = await prisma.marketLead.findFirst({ where: { id: leadId, userId } });
  if (!lead) throw new Error('Lead not found.');
  const display = mapMarketLead(lead);
  const fullName = display.name || display.title;
  if (!fullName) throw new Error('Lead needs a person name or title before it can become a contact.');

  if (lead.contactId) {
    const existingContact = await prisma.contact.findFirst({
      where: { id: lead.contactId, userId },
      select: {
        id: true,
        addressEnc: true,
        source: true,
        leadSourceId: true,
        usualCommunicationMethod: true,
        contactAttemptStatus: true,
        lastContactedAt: true,
        buyerStatus: true,
        sellerStatus: true
      }
    });
    const updateData = existingContact ? leadToContactUpdateData(display, lead, existingContact) : {};
    if (Object.keys(updateData).length) {
      await prisma.contact.updateMany({ where: { id: lead.contactId, userId }, data: updateData }).catch(() => null);
    }
    await prisma.marketLead.updateMany({ where: { id: leadId, userId }, data: { status: 'CONVERTED' as any, convertedAt: new Date() } });
    await prisma.task.updateMany({ where: { userId, marketLeadId: leadId, contactId: null }, data: { contactId: lead.contactId } }).catch(() => null);
    return lead.contactId;
  }

  const contact = await prisma.contact.create({
    data: {
      userId,
      fullNameEnc: encrypt(fullName, 'contact.full_name'),
      fullNameIdx: buildIndexToken(fullName),
      emailEnc: display.email ? encrypt(display.email, 'contact.email') : null,
      emailIdx: display.email ? buildIndexToken(display.email) : null,
      phoneEnc: display.phone ? encrypt(display.phone, 'contact.phone') : null,
      phoneIdx: display.phone ? buildIndexToken(display.phone) : null,
      companyEnc: display.companyName ? encrypt(display.companyName, 'contact.company') : null,
      companyIdx: display.companyName ? buildIndexToken(display.companyName) : null,
      positionEnc: display.roleTitle ? encrypt(display.roleTitle, 'contact.position') : null,
      positionIdx: display.roleTitle ? buildIndexToken(display.roleTitle) : null,
      linkedinEnc: display.linkedin ? encrypt(display.linkedin, 'contact.linkedin') : null,
      linkedinIdx: display.linkedin ? buildIndexToken(display.linkedin) : null,
      usualCommunicationMethod: display.usualCommunicationMethod || null,
      addressEnc: display.address ? encrypt(display.address, 'contact.address') : null,
      addressIdx: display.address ? buildIndexToken(display.address) : null,
      source: lead.source || 'MANUAL',
      leadSourceId: lead.leadSourceId || null,
      contactAttemptStatus: display.contactAttemptStatus || 'NOT_CONTACTED',
      lastContactedAt: lead.lastContactedAt || null,
      buyerStatus: display.buyerStatus || 'NOT_ASKED',
      sellerStatus: display.sellerStatus || 'NOT_ASKED'
    } as any,
    select: { id: true }
  });

  await prisma.marketLead.updateMany({ where: { id: leadId, userId }, data: { contactId: contact.id, status: 'CONVERTED' as any, convertedAt: new Date() } });
  await prisma.task.updateMany({ where: { userId, marketLeadId: leadId, contactId: null }, data: { contactId: contact.id } }).catch(() => null);
  return contact.id;
}

export async function convertLeadToCompany(userId: string, leadId: string) {
  const lead = await prisma.marketLead.findFirst({ where: { id: leadId, userId } });
  if (!lead) throw new Error('Lead not found.');
  const display = mapMarketLead(lead);
  const companyName = display.companyName || display.title || display.name;
  if (!companyName) throw new Error('Lead needs a company name or title before it can become a company.');

  if (lead.companyId) {
    await prisma.marketLead.updateMany({ where: { id: leadId, userId }, data: { status: 'CONVERTED' as any, convertedAt: new Date() } });
    await prisma.task.updateMany({ where: { userId, marketLeadId: leadId, companyId: null }, data: { companyId: lead.companyId } }).catch(() => null);
    return lead.companyId;
  }

  const company = await prisma.company.create({
    data: {
      userId,
      nameEnc: encrypt(companyName, 'company.name'),
      nameIdx: buildIndexToken(companyName),
      websiteEnc: display.website ? encrypt(display.website, 'company.website') : null,
      websiteIdx: display.website ? buildIndexToken(display.website) : null,
      phoneEnc: display.phone ? encrypt(display.phone, 'company.phone') : null,
      phoneIdx: display.phone ? buildIndexToken(display.phone) : null,
      locationEnc: (display.geography || display.address) ? encrypt(display.geography || display.address, 'company.location') : null,
      descriptionEnc: display.description ? encrypt(display.description, 'company.description') : null,
      notesEnc: display.notes ? encrypt(display.notes, 'company.notes') : null,
      kind: (display.type === 'BUYER' ? 'STRATEGIC_ACQUIRER' : 'OPERATING_BUSINESS') as any
    },
    select: { id: true }
  });

  await prisma.marketLead.updateMany({ where: { id: leadId, userId }, data: { companyId: company.id, status: 'CONVERTED' as any, convertedAt: new Date() } });
  await prisma.task.updateMany({ where: { userId, marketLeadId: leadId, companyId: null }, data: { companyId: company.id } }).catch(() => null);
  return company.id;
}

export async function convertLeadToDeal(userId: string, leadId: string) {
  const lead = await prisma.marketLead.findFirst({ where: { id: leadId, userId } });
  if (!lead) throw new Error('Lead not found.');
  const display = mapMarketLead(lead);
  const title = display.title || display.companyName || display.name || 'Untitled lead deal';

  if (lead.dealId) {
    await prisma.marketLead.updateMany({ where: { id: leadId, userId }, data: { status: 'CONVERTED' as any, convertedAt: new Date() } });
    if (lead.projectId) {
      await prisma.projectDeal.upsert({
        where: { projectId_dealId: { projectId: lead.projectId, dealId: lead.dealId } },
        update: {},
        create: { userId, projectId: lead.projectId, dealId: lead.dealId }
      }).catch(() => null);
    }
    await prisma.task.updateMany({ where: { userId, marketLeadId: leadId, dealId: null }, data: { dealId: lead.dealId } }).catch(() => null);
    return lead.dealId;
  }

  const deal = await prisma.deal.create({
    data: {
      userId,
      titleEnc: encrypt(title, 'deal.title'),
      titleIdx: buildIndexToken(title),
      descriptionEnc: display.description || display.notes ? encrypt([display.description, display.notes].filter(Boolean).join('\n\n'), 'deal.description') : null,
      valueCents: display.valueMaxCents || display.valueMinCents || null,
      currency: display.currency || 'AUD',
      status: 'DISCOVERY' as any,
      probability: display.confidence ? Math.min(100, Math.max(0, display.confidence)) : null
    },
    select: { id: true }
  });

  if (lead.contactId) {
    await prisma.dealContact.create({ data: { userId, dealId: deal.id, contactId: lead.contactId, label: display.type === 'BUYER' ? 'buyer lead' : display.type === 'SELLER' ? 'seller lead' : 'lead', relationshipType: display.type === 'BUYER' ? 'POTENTIAL_BUYER' as any : display.type === 'SELLER' ? 'SELLER' as any : null } }).catch(() => null);
  }
  if (lead.companyId) {
    await prisma.dealCompany.create({ data: { userId, dealId: deal.id, companyId: lead.companyId, label: display.type === 'BUYER' ? 'buyer lead' : display.type === 'SELLER' ? 'seller lead' : 'lead', relationshipType: display.type === 'BUYER' ? 'POTENTIAL_BUYER' as any : display.type === 'SELLER' ? 'SELLER' as any : null } }).catch(() => null);
  }
  if (lead.projectId) {
    await prisma.projectDeal.upsert({
      where: { projectId_dealId: { projectId: lead.projectId, dealId: deal.id } },
      update: {},
      create: { userId, projectId: lead.projectId, dealId: deal.id }
    }).catch(() => null);
  }

  await prisma.marketLead.updateMany({ where: { id: leadId, userId }, data: { dealId: deal.id, status: 'CONVERTED' as any, convertedAt: new Date() } });
  await prisma.task.updateMany({ where: { userId, marketLeadId: leadId, dealId: null }, data: { dealId: deal.id } }).catch(() => null);
  return deal.id;
}

export async function convertLeadToExchangeItem(userId: string, leadId: string, type: 'WANT' | 'OFFER') {
  const lead = await prisma.marketLead.findFirst({ where: { id: leadId, userId } });
  if (!lead) throw new Error('Lead not found.');
  const display = mapMarketLead(lead);
  const title = display.title || display.companyName || display.name || (type === 'WANT' ? 'Untitled want' : 'Untitled offer');

  const item = await prisma.exchangeItem.create({
    data: {
      userId,
      type: type as any,
      direction: type === 'WANT' ? 'SEEKING' as any : 'OFFERING' as any,
      titleEnc: encrypt(title, 'exchange.title'),
      descriptionEnc: display.description || display.notes ? encrypt([display.description, display.notes].filter(Boolean).join('\n\n'), 'exchange.description') : null,
      categoryEnc: display.type ? encrypt(marketLeadTypeLabel(display.type), 'exchange.category') : null,
      importance: display.priority || 3,
      confidence: display.confidence >= 75 ? 'HIGH' as any : display.confidence <= 35 ? 'LOW' as any : 'MEDIUM' as any,
      geographyEnc: display.geography ? encrypt(display.geography, 'exchange.geography') : null,
      valueMinCents: display.valueMinCents || null,
      valueMaxCents: display.valueMaxCents || null,
      currency: display.currency || 'AUD',
      contactId: lead.contactId || null,
      companyId: lead.companyId || null,
      dealId: lead.dealId || null,
      projectId: lead.projectId || null
    },
    select: { id: true }
  });

  await prisma.marketLead.updateMany({ where: { id: leadId, userId }, data: { exchangeItemId: item.id, status: 'CONVERTED' as any, convertedAt: new Date() } });
  return item.id;
}
