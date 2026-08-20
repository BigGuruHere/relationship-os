// src/lib/server/exchange.ts
// PURPOSE: Server-only helpers for encrypted wants/offers and future matching embeddings.
// SECURITY: All reads/writes are tenant scoped by userId and text fields are encrypted at rest.

import { prisma } from '$lib/db';
import { decrypt, encrypt } from '$lib/crypto';
import { createEmbeddingForText } from '$lib/embeddings_api';
import { parseMoneyToCents, formatDealValue } from '$lib/deals';
import {
  exchangeConfidenceLabel,
  exchangeDirectionLabel,
  exchangeStatusLabel,
  exchangeTimeHorizonLabel,
  exchangeTypeLabel,
  exchangeUrgencyLabel,
  importanceLabel,
  normaliseExchangeConfidence,
  normaliseExchangeDirection,
  normaliseExchangeStatus,
  normaliseExchangeTimeHorizon,
  normaliseExchangeType,
  normaliseExchangeUrgency
} from '$lib/exchange';

export type ExchangeEntityLink = {
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
  projectId?: string | null;
  companyContactId?: string | null;
};

function safeDecryptExchange(payload: string | null | undefined, aad: string, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, aad);
  } catch {
    return fallback;
  }
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
  type: string;
  title: string;
  description: string;
  summary: string;
  category: string;
  direction: string;
  importance: number;
  urgency: string;
  timeHorizon: string;
  status: string;
  confidence: string;
  geography: string;
  valueMin: string;
  valueMax: string;
  currency: string;
}) {
  return [
    `Type: ${input.type}`,
    `Title: ${input.title}`,
    input.description ? `Description: ${input.description}` : '',
    input.summary ? `Summary: ${input.summary}` : '',
    input.category ? `Category: ${input.category}` : '',
    `Direction: ${input.direction}`,
    `Importance: ${input.importance}`,
    `Urgency: ${input.urgency}`,
    `Time horizon: ${input.timeHorizon}`,
    `Status: ${input.status}`,
    `Confidence: ${input.confidence}`,
    input.geography ? `Geography: ${input.geography}` : '',
    input.valueMin || input.valueMax ? `Value range: ${input.valueMin || 'unspecified'} to ${input.valueMax || 'unspecified'} ${input.currency}` : ''
  ].filter(Boolean).join('\n');
}

async function storeExchangeEmbedding(userId: string, exchangeItemId: string, text: string) {
  const input = text.trim();
  if (!input) return;

  try {
    const vec = await createEmbeddingForText(input);
    if (!Array.isArray(vec) || vec.length === 0) return;
    await prisma.$executeRawUnsafe(
      'UPDATE "ExchangeItem" SET "embedding_vec" = $1::vector WHERE "id" = $2 AND "userId" = $3',
      toPgVectorLiteral(vec),
      exchangeItemId,
      userId
    );
  } catch (err: any) {
    // IT: Embeddings are important, but a failed OpenAI call should not block recording the want/offer.
    console.warn('[exchange] failed to store embedding', { exchangeItemId, message: err?.message });
  }
}

export async function createExchangeItemFromForm(params: {
  userId: string;
  form: FormData;
  links: ExchangeEntityLink;
}) {
  const { userId, form, links } = params;
  const title = String(form.get('exchangeTitle') || form.get('title') || '').trim();
  if (!title) throw new Error('Title is required.');

  const description = String(form.get('exchangeDescription') || form.get('description') || '').trim();
  const summary = String(form.get('exchangeSummary') || form.get('summary') || '').trim();
  const category = String(form.get('category') || '').trim();
  const geography = String(form.get('geography') || '').trim();
  const currency = String(form.get('currency') || 'AUD').trim().toUpperCase() || 'AUD';
  const valueMinRaw = String(form.get('valueMin') || '').trim();
  const valueMaxRaw = String(form.get('valueMax') || '').trim();

  const type = normaliseExchangeType(form.get('exchangeType') || form.get('type'));
  const direction = normaliseExchangeDirection(form.get('direction'));
  const urgency = normaliseExchangeUrgency(form.get('urgency'));
  const timeHorizon = normaliseExchangeTimeHorizon(form.get('timeHorizon'));
  const status = normaliseExchangeStatus(form.get('status'));
  const confidence = normaliseExchangeConfidence(form.get('confidence'));
  const importance = parseImportance(form.get('importance'));

  const row = await prisma.exchangeItem.create({
    data: {
      userId,
      type: type as any,
      direction: direction as any,
      categoryEnc: category ? encrypt(category, 'exchange.category') : null,
      titleEnc: encrypt(title, 'exchange.title'),
      descriptionEnc: description ? encrypt(description, 'exchange.description') : null,
      summaryEnc: summary ? encrypt(summary, 'exchange.summary') : null,
      importance,
      urgency: urgency as any,
      timeHorizon: timeHorizon as any,
      status: status as any,
      confidence: confidence as any,
      geographyEnc: geography ? encrypt(geography, 'exchange.geography') : null,
      valueMinCents: parseMoneyToCents(valueMinRaw),
      valueMaxCents: parseMoneyToCents(valueMaxRaw),
      currency,
      reviewAt: parseDate(form.get('reviewAt')),
      expiresAt: parseDate(form.get('expiresAt')),
      contactId: links.contactId || null,
      companyId: links.companyId || null,
      dealId: links.dealId || null,
      projectId: links.projectId || null,
      companyContactId: links.companyContactId || null
    },
    select: { id: true }
  });

  await storeExchangeEmbedding(userId, row.id, embeddingText({
    type,
    title,
    description,
    summary,
    category,
    direction,
    importance,
    urgency,
    timeHorizon,
    status,
    confidence,
    geography,
    valueMin: valueMinRaw,
    valueMax: valueMaxRaw,
    currency
  }));

  return row;
}

export async function loadExchangeItems(params: {
  userId: string;
  links: ExchangeEntityLink;
  take?: number;
}) {
  const where: any = { userId: params.userId };
  if (params.links.contactId) where.contactId = params.links.contactId;
  if (params.links.companyId) where.companyId = params.links.companyId;
  if (params.links.dealId) where.dealId = params.links.dealId;
  if (params.links.projectId) where.projectId = params.links.projectId;
  if (params.links.companyContactId) where.companyContactId = params.links.companyContactId;

  const rows = await prisma.exchangeItem.findMany({
    where,
    select: {
      id: true,
      type: true,
      direction: true,
      categoryEnc: true,
      titleEnc: true,
      descriptionEnc: true,
      summaryEnc: true,
      importance: true,
      urgency: true,
      timeHorizon: true,
      status: true,
      confidence: true,
      geographyEnc: true,
      valueMinCents: true,
      valueMaxCents: true,
      currency: true,
      reviewAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: [{ status: 'asc' }, { importance: 'desc' }, { updatedAt: 'desc' }],
    take: params.take ?? 50
  });

  return rows.map((row: any) => ({
    id: row.id,
    type: row.type,
    typeLabel: exchangeTypeLabel(row.type),
    direction: row.direction,
    directionLabel: exchangeDirectionLabel(row.direction),
    category: safeDecryptExchange(row.categoryEnc, 'exchange.category', ''),
    title: safeDecryptExchange(row.titleEnc, 'exchange.title', 'Untitled'),
    description: safeDecryptExchange(row.descriptionEnc, 'exchange.description', ''),
    summary: safeDecryptExchange(row.summaryEnc, 'exchange.summary', ''),
    importance: row.importance,
    importanceLabel: importanceLabel(row.importance),
    urgency: row.urgency,
    urgencyLabel: exchangeUrgencyLabel(row.urgency),
    timeHorizon: row.timeHorizon,
    timeHorizonLabel: exchangeTimeHorizonLabel(row.timeHorizon),
    status: row.status,
    statusLabel: exchangeStatusLabel(row.status),
    confidence: row.confidence,
    confidenceLabel: exchangeConfidenceLabel(row.confidence),
    geography: safeDecryptExchange(row.geographyEnc, 'exchange.geography', ''),
    valueMinLabel: typeof row.valueMinCents === 'number' ? formatDealValue(row.valueMinCents, row.currency) : '',
    valueMaxLabel: typeof row.valueMaxCents === 'number' ? formatDealValue(row.valueMaxCents, row.currency) : '',
    currency: row.currency || 'AUD',
    reviewAt: row.reviewAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

export async function deleteExchangeItem(params: { userId: string; id: string; links: ExchangeEntityLink }) {
  const where: any = { id: params.id, userId: params.userId };
  if (params.links.contactId) where.contactId = params.links.contactId;
  if (params.links.companyId) where.companyId = params.links.companyId;
  if (params.links.dealId) where.dealId = params.links.dealId;
  if (params.links.projectId) where.projectId = params.links.projectId;
  if (params.links.companyContactId) where.companyContactId = params.links.companyContactId;
  return prisma.exchangeItem.deleteMany({ where });
}
