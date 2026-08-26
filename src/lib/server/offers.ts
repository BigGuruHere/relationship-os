// src/lib/server/offers.ts
// PURPOSE: Server-only helpers for first-class Offer records.
// SECURITY: All reads/writes are tenant scoped by userId. Offer text is encrypted at rest.

import { prisma } from '$lib/db';
import { validateCommercialEntityLinks, type CommercialEntityLinks } from '$lib/server/commercialEntityLinks';
import { decrypt, encrypt } from '$lib/crypto';
import { createEmbeddingForText } from '$lib/embeddings_api';
import { parseMoneyToCents, formatDealValue, safeDecrypt } from '$lib/deals';
import { companyDisplay } from '$lib/companies';
import {
  importanceLabel,
  normaliseOfferConfidence,
  normaliseOfferDirection,
  normaliseOfferStatus,
  normaliseOfferTimeHorizon,
  normaliseOfferType,
  normaliseOfferUrgency,
  offerConfidenceLabel,
  offerDirectionLabel,
  offerStatusLabel,
  offerTimeHorizonLabel,
  offerTypeLabel,
  offerUrgencyLabel
} from '$lib/offers';

export type OfferEntityLink = CommercialEntityLinks;

function safeDecryptOffer(payload: string | null | undefined, aad: string, fallback = '', legacyAad?: string | string[]) {
  if (!payload) return fallback;
  const aads = [aad, ...(Array.isArray(legacyAad) ? legacyAad : legacyAad ? [legacyAad] : [])];
  for (const key of aads) {
    try {
      return decrypt(payload, key);
    } catch {
      // try next AAD
    }
  }
  return fallback;
}

function parseImportance(value: FormDataEntryValue | null) {
  const n = Number.parseInt(String(value || '3'), 10);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

function embeddingText(input: {
  offerType: string;
  status: string;
  direction: string;
  title: string;
  description: string;
  terms: string;
  summary: string;
  category: string;
  importance: number;
  urgency: string;
  timeHorizon: string;
  confidence: string;
  geography: string;
  valueMin: string;
  valueMax: string;
  currency: string;
}) {
  return [
    `Offer type: ${input.offerType}`,
    `Status: ${input.status}`,
    `Direction: ${input.direction}`,
    `Title: ${input.title}`,
    input.description ? `Description: ${input.description}` : '',
    input.terms ? `Terms: ${input.terms}` : '',
    input.summary ? `Summary: ${input.summary}` : '',
    input.category ? `Category: ${input.category}` : '',
    `Importance: ${input.importance}`,
    `Urgency: ${input.urgency}`,
    `Time horizon: ${input.timeHorizon}`,
    `Confidence: ${input.confidence}`,
    input.geography ? `Geography: ${input.geography}` : '',
    input.valueMin || input.valueMax ? `Value range: ${input.valueMin || 'unspecified'} to ${input.valueMax || 'unspecified'} ${input.currency}` : ''
  ].filter(Boolean).join('\n');
}

export async function storeOfferEmbedding(userId: string, offerId: string, text: string) {
  const input = text.trim();
  if (!input) return;
  try {
    const vec = await createEmbeddingForText(input);
    if (!Array.isArray(vec) || vec.length === 0) return;
    await prisma.$executeRawUnsafe(
      'UPDATE "Offer" SET "embedding_vec" = $1::vector WHERE "id" = $2 AND "userId" = $3',
      toPgVectorLiteral(vec),
      offerId,
      userId
    );
  } catch (err: any) {
    console.warn('[offers] failed to store embedding', { offerId, message: err?.message });
  }
}

export async function createOfferFromForm(params: { userId: string; form: FormData; links?: OfferEntityLink }) {
  const { userId, form, links = {} } = params;
  const title = String(form.get('offerTitle') || form.get('title') || '').trim();
  if (!title) throw new Error('Offer title is required.');

  const description = String(form.get('offerDescription') || form.get('description') || '').trim();
  const terms = String(form.get('terms') || '').trim();
  const summary = String(form.get('offerSummary') || form.get('summary') || '').trim();
  const category = String(form.get('category') || '').trim();
  const geography = String(form.get('geography') || '').trim();
  const currency = String(form.get('currency') || 'AUD').trim().toUpperCase() || 'AUD';
  const valueMinRaw = String(form.get('valueMin') || '').trim();
  const valueMaxRaw = String(form.get('valueMax') || '').trim();

  const offerType = normaliseOfferType(form.get('offerType'));
  const status = normaliseOfferStatus(form.get('status'));
  const direction = normaliseOfferDirection(form.get('direction'));
  const urgency = normaliseOfferUrgency(form.get('urgency'));
  const timeHorizon = normaliseOfferTimeHorizon(form.get('timeHorizon'));
  const confidence = normaliseOfferConfidence(form.get('confidence'));
  const importance = parseImportance(form.get('importance'));

  // IT: Route-provided links lock the corresponding browser fields. All resolved links are then
  // tenant-validated together, including relationship/contact/company consistency.
  const entityLinks = await validateCommercialEntityLinks(userId, {
    contactId: links.contactId || String(form.get('contactId') || '').trim() || null,
    companyId: links.companyId || String(form.get('companyId') || '').trim() || null,
    dealId: links.dealId || String(form.get('dealId') || '').trim() || null,
    projectId: links.projectId || String(form.get('projectId') || '').trim() || null,
    workstreamId: links.workstreamId || String(form.get('workstreamId') || '').trim() || null,
    companyContactId: links.companyContactId || String(form.get('companyContactId') || '').trim() || null
  });

  const row = await prisma.offer.create({
    data: {
      userId,
      offerType: offerType as any,
      status: status as any,
      direction: direction as any,
      titleEnc: encrypt(title, 'offer.title'),
      descriptionEnc: description ? encrypt(description, 'offer.description') : null,
      termsEnc: terms ? encrypt(terms, 'offer.terms') : null,
      summaryEnc: summary ? encrypt(summary, 'offer.summary') : null,
      categoryEnc: category ? encrypt(category, 'offer.category') : null,
      geographyEnc: geography ? encrypt(geography, 'offer.geography') : null,
      importance,
      urgency: urgency as any,
      timeHorizon: timeHorizon as any,
      confidence: confidence as any,
      valueMinCents: parseMoneyToCents(valueMinRaw),
      valueMaxCents: parseMoneyToCents(valueMaxRaw),
      currency,
      reviewAt: parseDate(form.get('reviewAt')),
      expiresAt: parseDate(form.get('expiresAt')),
      contactId: entityLinks.contactId,
      companyId: entityLinks.companyId,
      dealId: entityLinks.dealId,
      projectId: entityLinks.projectId,
      workstreamId: entityLinks.workstreamId,
      companyContactId: entityLinks.companyContactId
    },
    select: { id: true }
  });

  await storeOfferEmbedding(userId, row.id, embeddingText({
    offerType,
    status,
    direction,
    title,
    description,
    terms,
    summary,
    category,
    importance,
    urgency,
    timeHorizon,
    confidence,
    geography,
    valueMin: valueMinRaw,
    valueMax: valueMaxRaw,
    currency
  }));

  return row;
}

export async function updateOfferFromForm(params: { userId: string; offerId: string; form: FormData }) {
  const { userId, offerId, form } = params;
  const existing = await prisma.offer.findFirst({ where: { id: offerId, userId }, select: { id: true } });
  if (!existing) throw new Error('Offer not found.');
  const title = String(form.get('offerTitle') || form.get('title') || '').trim();
  if (!title) throw new Error('Offer title is required.');
  const description = String(form.get('offerDescription') || form.get('description') || '').trim();
  const terms = String(form.get('terms') || '').trim();
  const summary = String(form.get('offerSummary') || form.get('summary') || '').trim();
  const category = String(form.get('category') || '').trim();
  const geography = String(form.get('geography') || '').trim();
  const currency = String(form.get('currency') || 'AUD').trim().toUpperCase() || 'AUD';
  const valueMinRaw = String(form.get('valueMin') || '').trim();
  const valueMaxRaw = String(form.get('valueMax') || '').trim();
  const offerType = normaliseOfferType(form.get('offerType'));
  const status = normaliseOfferStatus(form.get('status'));
  const direction = normaliseOfferDirection(form.get('direction'));
  const urgency = normaliseOfferUrgency(form.get('urgency'));
  const timeHorizon = normaliseOfferTimeHorizon(form.get('timeHorizon'));
  const confidence = normaliseOfferConfidence(form.get('confidence'));
  const importance = parseImportance(form.get('importance'));

  // IT: Updates are just as strict as creates. Never rely on dropdown contents as an ownership boundary.
  const entityLinks = await validateCommercialEntityLinks(userId, {
    contactId: String(form.get('contactId') || '').trim() || null,
    companyId: String(form.get('companyId') || '').trim() || null,
    dealId: String(form.get('dealId') || '').trim() || null,
    projectId: String(form.get('projectId') || '').trim() || null,
    workstreamId: String(form.get('workstreamId') || '').trim() || null,
    companyContactId: String(form.get('companyContactId') || '').trim() || null
  });

  await prisma.offer.updateMany({
    where: { id: offerId, userId },
    data: {
      offerType: offerType as any,
      status: status as any,
      direction: direction as any,
      titleEnc: encrypt(title, 'offer.title'),
      descriptionEnc: description ? encrypt(description, 'offer.description') : null,
      termsEnc: terms ? encrypt(terms, 'offer.terms') : null,
      summaryEnc: summary ? encrypt(summary, 'offer.summary') : null,
      categoryEnc: category ? encrypt(category, 'offer.category') : null,
      geographyEnc: geography ? encrypt(geography, 'offer.geography') : null,
      importance,
      urgency: urgency as any,
      timeHorizon: timeHorizon as any,
      confidence: confidence as any,
      valueMinCents: parseMoneyToCents(valueMinRaw),
      valueMaxCents: parseMoneyToCents(valueMaxRaw),
      currency,
      reviewAt: parseDate(form.get('reviewAt')),
      expiresAt: parseDate(form.get('expiresAt')),
      contactId: entityLinks.contactId,
      companyId: entityLinks.companyId,
      dealId: entityLinks.dealId,
      projectId: entityLinks.projectId,
      workstreamId: entityLinks.workstreamId,
      companyContactId: entityLinks.companyContactId
    }
  });

  await storeOfferEmbedding(userId, offerId, embeddingText({
    offerType,
    status,
    direction,
    title,
    description,
    terms,
    summary,
    category,
    importance,
    urgency,
    timeHorizon,
    confidence,
    geography,
    valueMin: valueMinRaw,
    valueMax: valueMaxRaw,
    currency
  }));
}

export async function loadOffers(params: { userId: string; links?: OfferEntityLink; take?: number; includeArchived?: boolean }) {
  const where: any = { userId: params.userId };
  const links = params.links || {};
  if (links.contactId) where.contactId = links.contactId;
  if (links.companyId) where.companyId = links.companyId;
  if (links.dealId) where.dealId = links.dealId;
  if (links.projectId) where.projectId = links.projectId;
  if (links.workstreamId) where.workstreamId = links.workstreamId;
  if (links.companyContactId) where.companyContactId = links.companyContactId;
  if (!params.includeArchived) where.status = { not: 'ARCHIVED' as any };

  const rows = await prisma.offer.findMany({
    where,
    select: offerSelect,
    orderBy: [{ status: 'asc' }, { importance: 'desc' }, { updatedAt: 'desc' }],
    take: params.take ?? 50
  });
  return rows.map(mapOffer);
}

export const offerSelect = {
  id: true,
  offerType: true,
  status: true,
  direction: true,
  titleEnc: true,
  descriptionEnc: true,
  summaryEnc: true,
  termsEnc: true,
  categoryEnc: true,
  geographyEnc: true,
  importance: true,
  urgency: true,
  timeHorizon: true,
  confidence: true,
  valueMinCents: true,
  valueMaxCents: true,
  currency: true,
  reviewAt: true,
  expiresAt: true,
  contactId: true,
  companyId: true,
  dealId: true,
  projectId: true,
  workstreamId: true,
  companyContactId: true,
  convertedDealId: true,
  exchangeItemId: true,
  createdAt: true,
  updatedAt: true,
  contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
  company: { select: { id: true, nameEnc: true, kind: true, status: true } },
  deal: { select: { id: true, titleEnc: true, status: true } },
  project: { select: { id: true, titleEnc: true, status: true } },
  workstream: { select: { id: true, nameEnc: true, projectId: true, status: true } },
  companyContact: {
    select: {
      id: true,
      titleEnc: true,
      company: { select: { id: true, nameEnc: true } },
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
    }
  }
} as const;

export function mapOffer(row: any) {
  const title = safeDecryptOffer(row.titleEnc, 'offer.title', 'Untitled offer', ['exchange.title', 'company.name']);
  const description = safeDecryptOffer(row.descriptionEnc, 'offer.description', '', 'exchange.description');
  const terms = safeDecryptOffer(row.termsEnc, 'offer.terms', '', 'company.terms');
  const summary = safeDecryptOffer(row.summaryEnc, 'offer.summary', '', 'exchange.summary');
  const category = safeDecryptOffer(row.categoryEnc, 'offer.category', '', 'exchange.category');
  const geography = safeDecryptOffer(row.geographyEnc, 'offer.geography', '', 'exchange.geography');
  return {
    id: row.id,
    offerType: row.offerType,
    offerTypeLabel: offerTypeLabel(row.offerType),
    status: row.status,
    statusLabel: offerStatusLabel(row.status),
    direction: row.direction,
    directionLabel: offerDirectionLabel(row.direction),
    title,
    description,
    terms,
    summary,
    category,
    geography,
    importance: row.importance,
    importanceLabel: importanceLabel(row.importance),
    urgency: row.urgency,
    urgencyLabel: offerUrgencyLabel(row.urgency),
    timeHorizon: row.timeHorizon,
    timeHorizonLabel: offerTimeHorizonLabel(row.timeHorizon),
    confidence: row.confidence,
    confidenceLabel: offerConfidenceLabel(row.confidence),
    valueMinCents: row.valueMinCents,
    valueMaxCents: row.valueMaxCents,
    valueMinLabel: typeof row.valueMinCents === 'number' ? formatDealValue(row.valueMinCents, row.currency) : '',
    valueMaxLabel: typeof row.valueMaxCents === 'number' ? formatDealValue(row.valueMaxCents, row.currency) : '',
    currency: row.currency || 'AUD',
    reviewAt: row.reviewAt,
    expiresAt: row.expiresAt,
    contactId: row.contactId,
    companyId: row.companyId,
    dealId: row.dealId,
    projectId: row.projectId,
    workstreamId: row.workstreamId,
    companyContactId: row.companyContactId,
    convertedDealId: row.convertedDealId,
    exchangeItemId: row.exchangeItemId,
    contact: row.contact ? { id: row.contact.id, name: safeDecryptOffer(row.contact.fullNameEnc, 'contact.full_name', 'Relish user') } : null,
    company: row.company ? { id: row.company.id, name: companyDisplay(row.company), kind: row.company.kind, status: row.company.status } : null,
    deal: row.deal ? { id: row.deal.id, title: safeDecrypt(row.deal.titleEnc, 'deal.title', 'Untitled deal'), status: row.deal.status } : null,
    project: row.project ? { id: row.project.id, title: safeDecrypt(row.project.titleEnc, 'project.title', 'Untitled project'), status: row.project.status } : null,
    workstream: row.workstream ? { id: row.workstream.id, name: safeDecrypt(row.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream'), projectId: row.workstream.projectId, status: row.workstream.status } : null,
    companyContact: row.companyContact ? {
      id: row.companyContact.id,
      title: safeDecryptOffer(row.companyContact.titleEnc, 'company_contact.title', ''),
      company: row.companyContact.company ? { id: row.companyContact.company.id, name: safeDecrypt(row.companyContact.company.nameEnc, 'company.name', 'Untitled company') } : null,
      contact: row.companyContact.contact ? { id: row.companyContact.contact.id, name: safeDecryptOffer(row.companyContact.contact.fullNameEnc, 'contact.full_name', 'Relish user') } : null
    } : null,
    descriptionPreview: description ? description.slice(0, 240) : '',
    termsPreview: terms ? terms.slice(0, 240) : '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function loadOffer(userId: string, offerId: string) {
  const row = await prisma.offer.findFirst({ where: { id: offerId, userId }, select: offerSelect });
  return row ? mapOffer(row) : null;
}

export async function deleteOffer(params: { userId: string; id: string; links?: OfferEntityLink }) {
  const links = params.links || {};
  const where: any = { id: params.id, userId: params.userId };
  if (links.contactId) where.contactId = links.contactId;
  if (links.companyId) where.companyId = links.companyId;
  if (links.dealId) where.dealId = links.dealId;
  if (links.projectId) where.projectId = links.projectId;
  if (links.workstreamId) where.workstreamId = links.workstreamId;
  if (links.companyContactId) where.companyContactId = links.companyContactId;

  // IT: Entity panels mean "remove this link", not "destroy the commercial record". A permanent
  // delete only happens when this helper is deliberately called without a contextual link.
  if (Object.values(links).some(Boolean)) {
    const data: any = {};
    if (links.workstreamId) data.workstreamId = null;
    else if (links.projectId) { data.projectId = null; data.workstreamId = null; }
    if (links.contactId) { data.contactId = null; data.companyContactId = null; }
    if (links.companyId) { data.companyId = null; data.companyContactId = null; }
    if (links.dealId) data.dealId = null;
    if (links.companyContactId) data.companyContactId = null;
    return prisma.offer.updateMany({ where, data });
  }

  return prisma.offer.deleteMany({ where });
}

export async function createOfferNote(userId: string, offerId: string, form: FormData) {
  const offer = await prisma.offer.findFirst({ where: { id: offerId, userId }, select: { id: true } });
  if (!offer) throw new Error('Offer not found.');
  const body = String(form.get('body') || form.get('note') || '').trim();
  if (!body) throw new Error('Note body is required.');
  const summary = String(form.get('summary') || '').trim();
  const channel = String(form.get('channel') || 'note').trim() || 'note';
  await prisma.offerNote.create({
    data: {
      userId,
      offerId,
      occurredAt: parseDate(form.get('occurredAt')) || new Date(),
      channel,
      bodyEnc: encrypt(body, 'offer_note.body'),
      summaryEnc: summary ? encrypt(summary, 'offer_note.summary') : null
    }
  });
}

export async function updateOfferNote(userId: string, noteId: string, form: FormData) {
  const note = await prisma.offerNote.findFirst({ where: { id: noteId, userId }, select: { id: true, offerId: true } });
  if (!note) throw new Error('Offer note not found.');
  const body = String(form.get('body') || form.get('note') || '').trim();
  if (!body) throw new Error('Note body is required.');
  const summary = String(form.get('summary') || '').trim();
  const channel = String(form.get('channel') || 'note').trim() || 'note';
  await prisma.offerNote.updateMany({
    where: { id: noteId, userId },
    data: {
      occurredAt: parseDate(form.get('occurredAt')) || new Date(),
      channel,
      bodyEnc: encrypt(body, 'offer_note.body'),
      summaryEnc: summary ? encrypt(summary, 'offer_note.summary') : null
    }
  });
  return note.offerId;
}

export async function loadOfferNotes(userId: string, offerId: string) {
  const rows = await prisma.offerNote.findMany({
    where: { userId, offerId },
    select: { id: true, occurredAt: true, channel: true, bodyEnc: true, summaryEnc: true, createdAt: true, updatedAt: true },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take: 100
  });
  return rows.map((row: any) => ({
    id: row.id,
    occurredAt: row.occurredAt,
    channel: row.channel || 'note',
    body: safeDecryptOffer(row.bodyEnc, 'offer_note.body', ''),
    summary: safeDecryptOffer(row.summaryEnc, 'offer_note.summary', ''),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

export async function deleteOfferNote(userId: string, noteId: string) {
  const note = await prisma.offerNote.findFirst({ where: { id: noteId, userId }, select: { offerId: true } });
  if (!note) throw new Error('Offer note not found.');
  await prisma.offerNote.deleteMany({ where: { id: noteId, userId } });
  return note.offerId;
}
