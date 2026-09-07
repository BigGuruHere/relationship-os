// PURPOSE: Persist and load Workspace-specific reusable MarketLead next-action labels.
// SECURITY: Labels are encrypted at rest and deterministically indexed only within the active custody scope.

import { prisma } from '$lib/db';
import { buildScopedIndexToken, decrypt, encrypt } from '$lib/crypto';
import { contextSpaceIdForOwner } from '$lib/server/core/contextSpace';
import { DEFAULT_LEAD_NEXT_ACTIONS, mergeLeadNextActionOptions, normaliseLeadNextActionLabel } from '$lib/leadNextActions';

const LABEL_AAD = 'lead_next_action_option.label';
const LABEL_INDEX_SCOPE = 'lead_next_action_option:label';

function isBuiltIn(label: string) {
  const key = normaliseLeadNextActionLabel(label).toLocaleLowerCase();
  return DEFAULT_LEAD_NEXT_ACTIONS.some((item) => item.toLocaleLowerCase() === key);
}

export async function loadLeadNextActionOptions(userId: string, current = '') {
  const contextSpaceId = contextSpaceIdForOwner(userId);
  const rows = await (prisma as any).leadNextActionOption.findMany({
    where: { userId, contextSpaceId },
    select: { labelEnc: true },
    orderBy: { updatedAt: 'desc' },
    take: 200
  });
  const custom: string[] = [];
  for (const row of rows) {
    try {
      custom.push(decrypt(row.labelEnc, LABEL_AAD));
    } catch {
      // IT: A corrupt optional taxonomy label must not prevent opening a lead.
    }
  }
  return mergeLeadNextActionOptions(custom, current);
}

export async function rememberLeadNextActionOption(userId: string, rawLabel: string) {
  const label = normaliseLeadNextActionLabel(rawLabel);
  if (!label || isBuiltIn(label)) return;
  const contextSpaceId = contextSpaceIdForOwner(userId);
  const labelIdx = buildScopedIndexToken(label, LABEL_INDEX_SCOPE);

  const existing = await (prisma as any).leadNextActionOption.findFirst({
    where: { userId, contextSpaceId, labelIdx },
    select: { id: true }
  });
  if (existing) return;

  try {
    await (prisma as any).leadNextActionOption.create({
      data: {
        userId,
        contextSpaceId,
        labelEnc: encrypt(label, LABEL_AAD),
        labelIdx
      }
    });
  } catch (error: any) {
    // IT: Concurrent creation of the same normalized option is harmless; re-check before surfacing an error.
    const raced = await (prisma as any).leadNextActionOption.findFirst({
      where: { userId, contextSpaceId, labelIdx },
      select: { id: true }
    });
    if (!raced) throw error;
  }
}
