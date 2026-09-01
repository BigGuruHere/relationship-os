// src/lib/server/intentCommon.ts
// PURPOSE: Shared server-only plumbing for canonical Want/Offer records.
// SECURITY: This module centralises common parsing, encrypted text fallback, embedding writes, and link filters.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { createEmbeddingForText } from '$lib/embeddings_api';
import { commercialValueInputError, parseMoneyToCents } from '$lib/deals';
import type { CommercialEntityLinks } from '$lib/server/commercialEntityLinks';
import { contextSpaceIdForOwner } from '$lib/server/core/contextSpace';

export function safeDecryptIntent(payload: string | null | undefined, aad: string, fallback = '', legacyAad?: string | string[]) {
  if (!payload) return fallback;
  const aads = [aad, ...(Array.isArray(legacyAad) ? legacyAad : legacyAad ? [legacyAad] : [])];
  for (const key of aads) {
    try {
      return decrypt(payload, key);
    } catch {
      // IT: Continue through explicit legacy AADs for ciphertext copied out of historical ExchangeItem rows.
    }
  }
  return fallback;
}

export function parseIntentDate(value: FormDataEntryValue | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseIntentImportance(value: FormDataEntryValue | null) {
  const n = Number(value ?? 3);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function parseIntentMoney(form: FormData) {
  const valueMinRaw = String(form.get('valueMin') || '').trim();
  const valueMaxRaw = String(form.get('valueMax') || '').trim();
  const valueMinError = commercialValueInputError(valueMinRaw);
  const valueMaxError = commercialValueInputError(valueMaxRaw);
  if (valueMinError) throw new Error(`Minimum value: ${valueMinError}`);
  if (valueMaxError) throw new Error(`Maximum value: ${valueMaxError}`);
  return {
    valueMinCents: parseMoneyToCents(valueMinRaw),
    valueMaxCents: parseMoneyToCents(valueMaxRaw)
  };
}

export function intentLinkWhere(userId: string, links: CommercialEntityLinks = {}) {
  const where: any = { userId };
  if (links.contactId) where.contactId = links.contactId;
  if (links.personId) where.personId = links.personId;
  if (links.companyId) where.companyId = links.companyId;
  if (links.dealId) where.dealId = links.dealId;
  if (links.projectId) where.projectId = links.projectId;
  if (links.workstreamId) where.workstreamId = links.workstreamId;
  if (links.companyContactId) where.companyContactId = links.companyContactId;
  return where;
}

export function intentUnlinkData(links: CommercialEntityLinks = {}) {
  const data: any = {};
  if (links.contactId) data.contactId = null;
  if (links.personId) data.personId = null;
  if (links.companyId) {
    data.companyId = null;
    data.companyContactId = null;
  }
  if (links.dealId) data.dealId = null;
  if (links.projectId) {
    data.projectId = null;
    data.workstreamId = null;
  }
  if (links.workstreamId) data.workstreamId = null;
  if (links.companyContactId) data.companyContactId = null;
  return data;
}

function toPgVectorLiteral(vector: number[]) {
  return `[${vector.join(',')}]`;
}

export async function storeIntentEmbedding(params: {
  userId: string;
  id: string;
  table: 'Want' | 'Offer';
  text: string;
  logLabel: string;
}) {
  const input = params.text.trim();
  if (!input) return;
  const contextSpaceId = contextSpaceIdForOwner(params.userId);
  try {
    const vec = await createEmbeddingForText(input);
    if (!Array.isArray(vec) || vec.length === 0) return;
    // IT: Table name is constrained by the union above. Values remain positional query parameters.
    await prisma.$executeRawUnsafe(
      `UPDATE "${params.table}" SET "embedding_vec" = $1::vector WHERE "id" = $2 AND "userId" = $3 AND "contextSpaceId" = $4`,
      toPgVectorLiteral(vec),
      params.id,
      params.userId,
      contextSpaceId
    );
  } catch (err: any) {
    console.warn(`[${params.logLabel}] failed to store embedding`, { id: params.id, message: err?.message });
  }
}
