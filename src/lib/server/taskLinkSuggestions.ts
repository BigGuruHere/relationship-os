// src/lib/server/taskLinkSuggestions.ts
// PURPOSE: Rank likely Wants/Offers for a task without loading a giant dropdown into the browser.
// SECURITY: Every query is tenant-scoped. Plaintext exists only transiently after server-side decryption.

import { prisma } from '$lib/db';
import { mapWant, wantSelect } from '$lib/server/wants';
import { mapOffer, offerSelect } from '$lib/server/offers';

export type TaskCommercialLinkKind = 'want' | 'offer';

export type TaskCommercialLinkContext = {
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
  projectId?: string | null;
  workstreamId?: string | null;
  selectedId?: string | null;
};

export type TaskCommercialLinkSuggestion = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  typeLabel: string;
  category: string;
  geography: string;
  contactName: string;
  companyName: string;
  projectTitle: string;
  workstreamName: string;
  score: number;
  reasons: string[];
  updatedAt: Date | string;
};

const ACTIVE_WANT_STATUSES = new Set(['NEW', 'CLARIFYING_CRITERIA', 'ACTIVE_MANDATE', 'WATCHING_MARKET', 'MATCHED']);
const ACTIVE_OFFER_STATUSES = new Set(['NEW', 'CLARIFYING_SUPPLY', 'AVAILABLE', 'WATCHING_INTEREST', 'MATCHED']);

function clean(value: string | null | undefined) {
  return String(value || '').trim();
}

function lower(value: string | null | undefined) {
  return clean(value).toLowerCase();
}

function contextHasUsefulLink(context: TaskCommercialLinkContext) {
  return Boolean(context.contactId || context.companyId || context.dealId || context.projectId || context.workstreamId || context.selectedId);
}

function searchableText(item: any) {
  // IT: Search is performed after decrypting a bounded server-side candidate set because Want/Offer
  // text is encrypted at rest and therefore cannot safely be queried with SQL ILIKE.
  return [
    item.title,
    item.description,
    item.criteria,
    item.terms,
    item.summary,
    item.category,
    item.geography,
    item.wantTypeLabel,
    item.offerTypeLabel,
    item.statusLabel,
    item.contact?.name,
    item.company?.name,
    item.project?.title,
    item.workstream?.name
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function rankItem(kind: TaskCommercialLinkKind, item: any, context: TaskCommercialLinkContext, query = '') {
  let score = 0;
  const reasons: string[] = [];

  // IT: Text relevance matters once the user searches, while relationship context remains the
  // strongest signal when the picker is opened without a query.
  if (query) {
    const title = lower(item.title);
    if (title === query) { score += 90; reasons.push('exact title'); }
    else if (title.startsWith(query)) { score += 70; reasons.push('title starts with search'); }
    else if (title.includes(query)) { score += 50; reasons.push('title match'); }
    else if ([item.category, item.geography].some((value) => lower(value).includes(query))) score += 20;
    else score += 8;
  }

  // IT: Explicitly selected records remain pinned at the top while editing an existing task.
  if (context.selectedId && item.id === context.selectedId) {
    score += 250;
    reasons.push('currently linked');
  }
  if (context.workstreamId && item.workstreamId === context.workstreamId) {
    score += 100;
    reasons.push('same workstream');
  }
  if (context.projectId && item.projectId === context.projectId) {
    score += 55;
    reasons.push('same project');
  }
  if (context.contactId && item.contactId === context.contactId) {
    score += 50;
    reasons.push('same person');
  }
  if (context.companyId && item.companyId === context.companyId) {
    score += 50;
    reasons.push('same company');
  }
  if (context.dealId && item.dealId === context.dealId) {
    score += 45;
    reasons.push('same deal');
  }

  const activeStatuses = kind === 'want' ? ACTIVE_WANT_STATUSES : ACTIVE_OFFER_STATUSES;
  if (activeStatuses.has(item.status)) score += 18;

  // IT: Importance and recency are tie-breakers, not substitutes for relationship context.
  score += Math.max(0, Math.min(5, Number(item.importance || 0))) * 2;
  const updated = new Date(item.updatedAt || 0).getTime();
  if (Number.isFinite(updated)) {
    const ageDays = Math.max(0, (Date.now() - updated) / 86_400_000);
    score += Math.max(0, 12 - Math.min(12, ageDays / 30));
  }

  return { score, reasons };
}

function toSuggestion(kind: TaskCommercialLinkKind, item: any, score: number, reasons: string[]): TaskCommercialLinkSuggestion {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    statusLabel: item.statusLabel,
    typeLabel: kind === 'want' ? item.wantTypeLabel : item.offerTypeLabel,
    category: item.category || '',
    geography: item.geography || '',
    contactName: item.contact?.name || '',
    companyName: item.company?.name || '',
    projectTitle: item.project?.title || '',
    workstreamName: item.workstream?.name || '',
    score,
    reasons,
    updatedAt: item.updatedAt
  };
}

export async function getTaskCommercialLinkSuggestions(params: {
  userId: string;
  kind: TaskCommercialLinkKind;
  query?: string;
  context?: TaskCommercialLinkContext;
  limit?: number;
}) {
  const { userId, kind } = params;
  const query = lower(params.query);
  const context = params.context || {};
  const limit = Math.max(1, Math.min(30, params.limit ?? 12));

  // IT: With no free-text query, first constrain at the database level to records that share task
  // context. A recent-record fallback keeps the picker useful for standalone tasks.
  const contextOr: any[] = [];
  if (context.selectedId) contextOr.push({ id: context.selectedId });
  if (context.workstreamId) contextOr.push({ workstreamId: context.workstreamId });
  if (context.projectId) contextOr.push({ projectId: context.projectId });
  if (context.contactId) contextOr.push({ contactId: context.contactId });
  if (context.companyId) contextOr.push({ companyId: context.companyId });
  if (context.dealId) contextOr.push({ dealId: context.dealId });

  const where: any = { userId, status: { not: 'ARCHIVED' as any } };
  if (!query && contextHasUsefulLink(context) && contextOr.length) where.OR = contextOr;

  // IT: A searched picker intentionally decrypts a bounded candidate set on the server. This is
  // appropriate for the expected thousands-of-records scale while preserving encrypted-at-rest text.
  const take = query ? 3000 : contextOr.length ? 250 : 80;
  // IT: Keep the Prisma branches separate so TypeScript never has to infer one union row shape
  // across the distinct Want and Offer selects. Both branches return the same mapped UI shape.
  let mapped: any[];
  if (kind === 'want') {
    const rows = await prisma.want.findMany({ where, select: wantSelect, orderBy: { updatedAt: 'desc' }, take });
    mapped = rows.map(mapWant);
    if (context.selectedId && !mapped.some((item: any) => item.id === context.selectedId)) {
      const selected = await prisma.want.findFirst({ where: { id: context.selectedId, userId }, select: wantSelect });
      if (selected) mapped.unshift(mapWant(selected));
    }
  } else {
    const rows = await prisma.offer.findMany({ where, select: offerSelect, orderBy: { updatedAt: 'desc' }, take });
    mapped = rows.map(mapOffer);
    if (context.selectedId && !mapped.some((item: any) => item.id === context.selectedId)) {
      const selected = await prisma.offer.findFirst({ where: { id: context.selectedId, userId }, select: offerSelect });
      if (selected) mapped.unshift(mapOffer(selected));
    }
  }

  // IT: The current link is always retained even if it falls outside the bounded recent candidate
  // set. This prevents a valid selected record disappearing as the account grows.
  const filtered = query ? mapped.filter((item: any) => item.id === context.selectedId || searchableText(item).includes(query)) : mapped;

  return filtered
    .map((item: any) => {
      const { score, reasons } = rankItem(kind, item, context, query);
      return toSuggestion(kind, item, score, reasons);
    })
    .sort((a, b) => b.score - a.score || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}
