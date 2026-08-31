// src/lib/server/wants.ts
// PURPOSE: Server-only helpers for first-class Want records.
// SECURITY: All reads/writes are tenant scoped by userId. Want text is encrypted at rest.

import { prisma } from '$lib/db';
import { validateCommercialEntityLinks, type CommercialEntityLinks } from '$lib/server/commercialEntityLinks';
import { decrypt, encrypt } from '$lib/crypto';
import { createEmbeddingForText } from '$lib/embeddings_api';
import { commercialValueInputError, parseMoneyToCents, formatDealValue, safeDecrypt } from '$lib/deals';
import { companyDisplay, safeDecryptCompany } from '$lib/companies';
import {
  importanceLabel,
  normaliseWantConfidence,
  normaliseWantStatus,
  normaliseWantTimeHorizon,
  normaliseWantType,
  normaliseWantUrgency,
  wantConfidenceLabel,
  wantStatusLabel,
  wantTimeHorizonLabel,
  wantTypeLabel,
  wantUrgencyLabel
} from '$lib/wants';
import { knowledgeAuthorityLabel, knowledgeSourceTypeLabel, normaliseKnowledgeAuthority, normaliseKnowledgeSourceType } from '$lib/provenance';

export type WantEntityLink = CommercialEntityLinks;

function safeDecryptWant(payload: string | null | undefined, aad: string, fallback = '', legacyAad?: string | string[]) {
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
  wantType: string;
  status: string;
  title: string;
  description: string;
  criteria: string;
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
    `Want type: ${input.wantType}`,
    `Status: ${input.status}`,
    `Title: ${input.title}`,
    input.description ? `Description: ${input.description}` : '',
    input.criteria ? `Criteria: ${input.criteria}` : '',
    input.summary ? `Summary: ${input.summary}` : '',
    input.category ? `Category: ${input.category}` : '',
    `Importance: ${input.importance}`,
    `Urgency: ${input.urgency}`,
    `Time horizon: ${input.timeHorizon}`,
    `Confidence: ${input.confidence}`,
    input.geography ? `Geography: ${input.geography}` : '',
    input.valueMin || input.valueMax ? `Value range ($m): ${input.valueMin || 'unspecified'} to ${input.valueMax || 'unspecified'} ${input.currency}` : ''
  ].filter(Boolean).join('\n');
}

export async function storeWantEmbedding(userId: string, wantId: string, text: string) {
  const input = text.trim();
  if (!input) return;
  try {
    const vec = await createEmbeddingForText(input);
    if (!Array.isArray(vec) || vec.length === 0) return;
    await prisma.$executeRawUnsafe(
      'UPDATE "Want" SET "embedding_vec" = $1::vector WHERE "id" = $2 AND "userId" = $3',
      toPgVectorLiteral(vec),
      wantId,
      userId
    );
  } catch (err: any) {
    console.warn('[wants] failed to store embedding', { wantId, message: err?.message });
  }
}

export async function createWantFromForm(params: { userId: string; form: FormData; links?: WantEntityLink }) {
  const { userId, form, links = {} } = params;
  const title = String(form.get('wantTitle') || form.get('title') || '').trim();
  if (!title) throw new Error('Want title is required.');

  const description = String(form.get('wantDescription') || form.get('description') || '').trim();
  const criteria = String(form.get('criteria') || '').trim();
  const summary = String(form.get('wantSummary') || form.get('summary') || '').trim();
  const category = String(form.get('category') || '').trim();
  const geography = String(form.get('geography') || '').trim();
  const currency = String(form.get('currency') || 'AUD').trim().toUpperCase() || 'AUD';
  const valueMinRaw = String(form.get('valueMin') || '').trim();
  const valueMaxRaw = String(form.get('valueMax') || '').trim();
  const valueMinError = commercialValueInputError(valueMinRaw);
  const valueMaxError = commercialValueInputError(valueMaxRaw);
  if (valueMinError) throw new Error(`Minimum value: ${valueMinError}`);
  if (valueMaxError) throw new Error(`Maximum value: ${valueMaxError}`);

  const wantType = normaliseWantType(form.get('wantType'));
  const status = normaliseWantStatus(form.get('status'));
  const urgency = normaliseWantUrgency(form.get('urgency'));
  const timeHorizon = normaliseWantTimeHorizon(form.get('timeHorizon'));
  const confidence = normaliseWantConfidence(form.get('confidence'));
  const authority = normaliseKnowledgeAuthority(form.get('authority'), 'THIRD_PARTY_REPORTED');
  const sourceType = normaliseKnowledgeSourceType(form.get('sourceType'), 'MANUAL');
  const sourceNote = String(form.get('sourceNote') || '').trim();
  const sourceInteractionId = String(form.get('sourceInteractionId') || '').trim() || null;
  const confirmedAt = parseDate(form.get('confirmedAt'));
  if (sourceInteractionId) {
    const sourceInteraction = await prisma.interaction.findFirst({ where: { id: sourceInteractionId, userId }, select: { id: true } });
    if (!sourceInteraction) throw new Error('Source interaction not found in this workspace.');
  }
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

  const row = await prisma.want.create({
    data: {
      userId,
      wantType: wantType as any,
      status: status as any,
      titleEnc: encrypt(title, 'want.title'),
      descriptionEnc: description ? encrypt(description, 'want.description') : null,
      criteriaEnc: criteria ? encrypt(criteria, 'want.criteria') : null,
      summaryEnc: summary ? encrypt(summary, 'want.summary') : null,
      categoryEnc: category ? encrypt(category, 'want.category') : null,
      geographyEnc: geography ? encrypt(geography, 'want.geography') : null,
      importance,
      urgency: urgency as any,
      timeHorizon: timeHorizon as any,
      confidence: confidence as any,
      authority: authority as any,
      sourceType: sourceType as any,
      sourceInteractionId,
      sourceNoteEnc: sourceNote ? encrypt(sourceNote, 'want.source_note') : null,
      confirmedAt,
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

  await storeWantEmbedding(userId, row.id, embeddingText({
    wantType,
    status,
    title,
    description,
    criteria,
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

export async function updateWantFromForm(params: { userId: string; wantId: string; form: FormData }) {
  const { userId, wantId, form } = params;
  const existing = await prisma.want.findFirst({ where: { id: wantId, userId }, select: { id: true } });
  if (!existing) throw new Error('Want not found.');
  const title = String(form.get('wantTitle') || form.get('title') || '').trim();
  if (!title) throw new Error('Want title is required.');
  const description = String(form.get('wantDescription') || form.get('description') || '').trim();
  const criteria = String(form.get('criteria') || '').trim();
  const summary = String(form.get('wantSummary') || form.get('summary') || '').trim();
  const category = String(form.get('category') || '').trim();
  const geography = String(form.get('geography') || '').trim();
  const currency = String(form.get('currency') || 'AUD').trim().toUpperCase() || 'AUD';
  const valueMinRaw = String(form.get('valueMin') || '').trim();
  const valueMaxRaw = String(form.get('valueMax') || '').trim();
  const valueMinError = commercialValueInputError(valueMinRaw);
  const valueMaxError = commercialValueInputError(valueMaxRaw);
  if (valueMinError) throw new Error(`Minimum value: ${valueMinError}`);
  if (valueMaxError) throw new Error(`Maximum value: ${valueMaxError}`);
  const wantType = normaliseWantType(form.get('wantType'));
  const status = normaliseWantStatus(form.get('status'));
  const urgency = normaliseWantUrgency(form.get('urgency'));
  const timeHorizon = normaliseWantTimeHorizon(form.get('timeHorizon'));
  const confidence = normaliseWantConfidence(form.get('confidence'));
  const authority = normaliseKnowledgeAuthority(form.get('authority'), 'THIRD_PARTY_REPORTED');
  const sourceType = normaliseKnowledgeSourceType(form.get('sourceType'), 'MANUAL');
  const sourceNote = String(form.get('sourceNote') || '').trim();
  const sourceInteractionId = String(form.get('sourceInteractionId') || '').trim() || null;
  const confirmedAt = parseDate(form.get('confirmedAt'));
  if (sourceInteractionId) {
    const sourceInteraction = await prisma.interaction.findFirst({ where: { id: sourceInteractionId, userId }, select: { id: true } });
    if (!sourceInteraction) throw new Error('Source interaction not found in this workspace.');
  }
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

  await prisma.want.updateMany({
    where: { id: wantId, userId },
    data: {
      wantType: wantType as any,
      status: status as any,
      titleEnc: encrypt(title, 'want.title'),
      descriptionEnc: description ? encrypt(description, 'want.description') : null,
      criteriaEnc: criteria ? encrypt(criteria, 'want.criteria') : null,
      summaryEnc: summary ? encrypt(summary, 'want.summary') : null,
      categoryEnc: category ? encrypt(category, 'want.category') : null,
      geographyEnc: geography ? encrypt(geography, 'want.geography') : null,
      importance,
      urgency: urgency as any,
      timeHorizon: timeHorizon as any,
      confidence: confidence as any,
      authority: authority as any,
      sourceType: sourceType as any,
      sourceInteractionId,
      sourceNoteEnc: sourceNote ? encrypt(sourceNote, 'want.source_note') : null,
      confirmedAt,
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

  await storeWantEmbedding(userId, wantId, embeddingText({
    wantType,
    status,
    title,
    description,
    criteria,
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


export async function applyCompanyAcquisitionCriteria(params: {
  userId: string;
  companyId: string;
  criteria: string;
  overwrite?: boolean;
}) {
  const { userId, companyId, overwrite = false } = params;
  const criteria = String(params.criteria || '').trim();
  if (!criteria) throw new Error('Acquisition criteria is required.');

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId },
    select: { id: true, nameEnc: true }
  });
  if (!company) throw new Error('Company not found.');

  const existing = await prisma.want.findFirst({
    where: { userId, companyId, wantType: 'ACQUISITION_CRITERIA' as any, status: { not: 'ARCHIVED' as any } },
    select: { id: true, criteriaEnc: true, titleEnc: true },
    orderBy: { createdAt: 'asc' }
  });

  if (existing?.criteriaEnc && !overwrite) return { id: existing.id, changed: false };

  const companyName = safeDecryptCompany(company.nameEnc, 'company.name', 'Company');
  if (existing) {
    // IT: Agent-applied criteria updates the first-class Want. Legacy Company.criteriaEnc is no longer
    // the working source of truth, although the old column remains for migration compatibility.
    await prisma.want.updateMany({
      where: { id: existing.id, userId },
      data: { criteriaEnc: encrypt(criteria, 'want.criteria'), authority: 'SYSTEM_DERIVED' as any, sourceType: 'AGENT' as any, confirmedAt: new Date() }
    });
    await storeWantEmbedding(userId, existing.id, `Acquisition criteria for ${companyName}\n${criteria}`);
    return { id: existing.id, changed: true };
  }

  const title = `Acquisition criteria - ${companyName}`;
  const created = await prisma.want.create({
    data: {
      userId,
      companyId,
      wantType: 'ACQUISITION_CRITERIA' as any,
      status: 'WATCHING_MARKET' as any,
      titleEnc: encrypt(title, 'want.title'),
      criteriaEnc: encrypt(criteria, 'want.criteria'),
      importance: 3,
      urgency: 'NORMAL' as any,
      timeHorizon: 'ONGOING' as any,
      confidence: 'MEDIUM' as any,
      authority: 'SYSTEM_DERIVED' as any,
      sourceType: 'AGENT' as any,
      confirmedAt: new Date()
    },
    select: { id: true }
  });
  await storeWantEmbedding(userId, created.id, `${title}\n${criteria}`);
  return { id: created.id, changed: true };
}

export async function loadWants(params: { userId: string; links?: WantEntityLink; take?: number; includeArchived?: boolean }) {
  const where: any = { userId: params.userId };
  const links = params.links || {};
  if (links.contactId) where.contactId = links.contactId;
  if (links.companyId) where.companyId = links.companyId;
  if (links.dealId) where.dealId = links.dealId;
  if (links.projectId) where.projectId = links.projectId;
  if (links.workstreamId) where.workstreamId = links.workstreamId;
  if (links.companyContactId) where.companyContactId = links.companyContactId;
  if (!params.includeArchived) where.status = { not: 'ARCHIVED' as any };

  const rows = await prisma.want.findMany({
    where,
    select: wantSelect,
    orderBy: [{ status: 'asc' }, { importance: 'desc' }, { updatedAt: 'desc' }],
    take: params.take ?? 50
  });
  return rows.map(mapWant);
}

export const wantSelect = {
  id: true,
  wantType: true,
  status: true,
  titleEnc: true,
  descriptionEnc: true,
  summaryEnc: true,
  criteriaEnc: true,
  categoryEnc: true,
  geographyEnc: true,
  importance: true,
  urgency: true,
  timeHorizon: true,
  confidence: true,
  authority: true,
  sourceType: true,
  sourceInteractionId: true,
  sourceNoteEnc: true,
  confirmedAt: true,
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

export function mapWant(row: any) {
  const title = safeDecryptWant(row.titleEnc, 'want.title', 'Untitled want', ['exchange.title', 'company.name']);
  const description = safeDecryptWant(row.descriptionEnc, 'want.description', '', 'exchange.description');
  const criteria = safeDecryptWant(row.criteriaEnc, 'want.criteria', '', 'company.criteria');
  const summary = safeDecryptWant(row.summaryEnc, 'want.summary', '', 'exchange.summary');
  const category = safeDecryptWant(row.categoryEnc, 'want.category', '', 'exchange.category');
  const geography = safeDecryptWant(row.geographyEnc, 'want.geography', '', 'exchange.geography');
  const sourceNote = safeDecryptWant(row.sourceNoteEnc, 'want.source_note', '');
  return {
    id: row.id,
    wantType: row.wantType,
    wantTypeLabel: wantTypeLabel(row.wantType),
    status: row.status,
    statusLabel: wantStatusLabel(row.status),
    title,
    description,
    criteria,
    summary,
    category,
    geography,
    importance: row.importance,
    importanceLabel: importanceLabel(row.importance),
    urgency: row.urgency,
    urgencyLabel: wantUrgencyLabel(row.urgency),
    timeHorizon: row.timeHorizon,
    timeHorizonLabel: wantTimeHorizonLabel(row.timeHorizon),
    confidence: row.confidence,
    confidenceLabel: wantConfidenceLabel(row.confidence),
    authority: row.authority,
    authorityLabel: knowledgeAuthorityLabel(row.authority),
    sourceType: row.sourceType,
    sourceTypeLabel: knowledgeSourceTypeLabel(row.sourceType),
    sourceInteractionId: row.sourceInteractionId,
    sourceNote,
    confirmedAt: row.confirmedAt,
    valueMinCents: row.valueMinCents === null || row.valueMinCents === undefined ? null : row.valueMinCents.toString(),
    valueMaxCents: row.valueMaxCents === null || row.valueMaxCents === undefined ? null : row.valueMaxCents.toString(),
    valueMinLabel: row.valueMinCents === null || row.valueMinCents === undefined ? '' : formatDealValue(row.valueMinCents, row.currency),
    valueMaxLabel: row.valueMaxCents === null || row.valueMaxCents === undefined ? '' : formatDealValue(row.valueMaxCents, row.currency),
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
    contact: row.contact ? { id: row.contact.id, name: safeDecryptWant(row.contact.fullNameEnc, 'contact.full_name', 'Relish user') } : null,
    company: row.company ? { id: row.company.id, name: companyDisplay(row.company), kind: row.company.kind, status: row.company.status } : null,
    deal: row.deal ? { id: row.deal.id, title: safeDecrypt(row.deal.titleEnc, 'deal.title', 'Untitled deal'), status: row.deal.status } : null,
    project: row.project ? { id: row.project.id, title: safeDecrypt(row.project.titleEnc, 'project.title', 'Untitled project'), status: row.project.status } : null,
    workstream: row.workstream ? { id: row.workstream.id, name: safeDecrypt(row.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream'), projectId: row.workstream.projectId, status: row.workstream.status } : null,
    companyContact: row.companyContact ? {
      id: row.companyContact.id,
      title: safeDecryptWant(row.companyContact.titleEnc, 'company_contact.title', ''),
      company: row.companyContact.company ? { id: row.companyContact.company.id, name: safeDecrypt(row.companyContact.company.nameEnc, 'company.name', 'Untitled company') } : null,
      contact: row.companyContact.contact ? { id: row.companyContact.contact.id, name: safeDecryptWant(row.companyContact.contact.fullNameEnc, 'contact.full_name', 'Relish user') } : null
    } : null,
    descriptionPreview: description ? description.slice(0, 240) : '',
    criteriaPreview: criteria ? criteria.slice(0, 240) : '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function loadWant(userId: string, wantId: string) {
  const row = await prisma.want.findFirst({ where: { id: wantId, userId }, select: wantSelect });
  return row ? mapWant(row) : null;
}

export async function deleteWant(params: { userId: string; id: string; links?: WantEntityLink }) {
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
    return prisma.want.updateMany({ where, data });
  }

  return prisma.want.deleteMany({ where });
}

export async function createWantNote(userId: string, wantId: string, form: FormData) {
  const want = await prisma.want.findFirst({ where: { id: wantId, userId }, select: { id: true } });
  if (!want) throw new Error('Want not found.');
  const body = String(form.get('body') || form.get('note') || '').trim();
  if (!body) throw new Error('Note body is required.');
  const summary = String(form.get('summary') || '').trim();
  const channel = String(form.get('channel') || 'note').trim() || 'note';
  await prisma.wantNote.create({
    data: {
      userId,
      wantId,
      occurredAt: parseDate(form.get('occurredAt')) || new Date(),
      channel,
      bodyEnc: encrypt(body, 'want_note.body'),
      summaryEnc: summary ? encrypt(summary, 'want_note.summary') : null
    }
  });
}

export async function updateWantNote(userId: string, noteId: string, form: FormData) {
  const note = await prisma.wantNote.findFirst({ where: { id: noteId, userId }, select: { id: true, wantId: true } });
  if (!note) throw new Error('Want note not found.');
  const body = String(form.get('body') || form.get('note') || '').trim();
  if (!body) throw new Error('Note body is required.');
  const summary = String(form.get('summary') || '').trim();
  const channel = String(form.get('channel') || 'note').trim() || 'note';
  await prisma.wantNote.updateMany({
    where: { id: noteId, userId },
    data: {
      occurredAt: parseDate(form.get('occurredAt')) || new Date(),
      channel,
      bodyEnc: encrypt(body, 'want_note.body'),
      summaryEnc: summary ? encrypt(summary, 'want_note.summary') : null
    }
  });
  return note.wantId;
}

export async function loadWantNotes(userId: string, wantId: string) {
  const rows = await prisma.wantNote.findMany({
    where: { userId, wantId },
    select: { id: true, occurredAt: true, channel: true, bodyEnc: true, summaryEnc: true, createdAt: true, updatedAt: true },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take: 100
  });
  return rows.map((row: any) => ({
    id: row.id,
    occurredAt: row.occurredAt,
    channel: row.channel || 'note',
    body: safeDecryptWant(row.bodyEnc, 'want_note.body', ''),
    summary: safeDecryptWant(row.summaryEnc, 'want_note.summary', ''),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

export async function deleteWantNote(userId: string, noteId: string) {
  const note = await prisma.wantNote.findFirst({ where: { id: noteId, userId }, select: { wantId: true } });
  if (!note) throw new Error('Want note not found.');
  await prisma.wantNote.deleteMany({ where: { id: noteId, userId } });
  return note.wantId;
}
