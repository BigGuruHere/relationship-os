// Stage 8.13.0 - non-authoritative working checkpoints for the Living Understanding pipeline.
// SECURITY: draft state is encrypted, custody scoped, short-lived and never treated as approved knowledge.
import { prisma } from '$lib/db';
import { encrypt, decrypt } from '$lib/crypto';
import { requireDatingPerson, type Scope } from './datingUnderstandingTopics';
import { requireSourceReflection } from './datingLivingUnderstanding';

const DRAFT_AAD = 'dating.living_understanding.draft';
const DRAFT_SOURCES_AAD = 'dating.living_understanding.draft.sources';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STATE_BYTES = 180_000;

type DraftState = {
  longitudinalSeed: unknown[];
  priorOperationalUnits: unknown[];
  chainHistory: unknown[];
};

export type LivingUnderstandingDraftBinding = {
  sourceInteractionId: string;
  baselineRevisionId: string | null;
  baselineRevisionNumber: number | null;
};

function normaliseState(raw: DraftState): DraftState {
  return {
    longitudinalSeed: Array.isArray(raw?.longitudinalSeed) ? raw.longitudinalSeed.slice(0, 32) : [],
    priorOperationalUnits: Array.isArray(raw?.priorOperationalUnits) ? raw.priorOperationalUnits.slice(0, 50) : [],
    chainHistory: Array.isArray(raw?.chainHistory) ? raw.chainHistory.slice(-8) : []
  };
}

function sourceIdsFromState(state: DraftState) {
  const ids = new Set<string>();
  for (const row of state.longitudinalSeed as any[]) {
    if (row?.sourceInteractionId) ids.add(String(row.sourceInteractionId));
    if (Array.isArray(row?.sourceInteractionIds)) for (const id of row.sourceInteractionIds) if (id) ids.add(String(id));
  }
  for (const row of state.chainHistory as any[]) if (row?.sourceInteractionId) ids.add(String(row.sourceInteractionId));
  return [...ids].slice(0, 32);
}

async function latestAuthoritativeRevision(scope: Scope) {
  return prisma.livingUnderstandingRevision.findFirst({
    where: scope,
    orderBy: { revisionNumber: 'desc' },
    select: { id: true, revisionNumber: true }
  });
}

async function validateBinding(scope: Scope, binding: LivingUnderstandingDraftBinding) {
  const sourceInteractionId = String(binding.sourceInteractionId || '');
  if (!sourceInteractionId) throw new Error('A bound Living Understanding checkpoint requires its new source.');
  await requireSourceReflection(scope, sourceInteractionId);

  const latest = await latestAuthoritativeRevision(scope);
  const expectedId = binding.baselineRevisionId ? String(binding.baselineRevisionId) : null;
  const expectedNumber = binding.baselineRevisionNumber == null ? null : Number(binding.baselineRevisionNumber);
  if ((latest?.id ?? null) !== expectedId || (latest?.revisionNumber ?? null) !== expectedNumber) {
    throw new Error('The Living Understanding checkpoint baseline is stale. Review the source against the current authoritative revision.');
  }
  return {
    sourceInteractionId,
    baselineRevisionId: expectedId,
    baselineRevisionNumber: expectedNumber
  };
}

export async function saveLivingUnderstandingDraft(
  scope: Scope,
  stage: string,
  rawState: DraftState,
  draftId = '',
  binding?: LivingUnderstandingDraftBinding
) {
  await requireDatingPerson(scope);
  const state = normaliseState(rawState);
  if (!state.longitudinalSeed.length) throw new Error('A Living Understanding checkpoint requires a longitudinal seed.');
  const sourceIds = sourceIdsFromState(state);
  if (!sourceIds.length) throw new Error('A Living Understanding checkpoint requires source provenance.');
  await Promise.all(sourceIds.map(id => requireSourceReflection(scope, id)));
  const plain = JSON.stringify(state);
  if (Buffer.byteLength(plain, 'utf8') > MAX_STATE_BYTES) throw new Error('The Living Understanding checkpoint is too large.');

  // IT: New Stage 8.13 production checkpoints are explicitly bound to one new source and one
  // authoritative baseline. The legacy read-only experiment may still create unbound checkpoints
  // until its UI is replaced in the next gate.
  const bound = binding ? await validateBinding(scope, binding) : {
    sourceInteractionId: null,
    baselineRevisionId: null,
    baselineRevisionNumber: null
  };
  const data = {
    ...bound,
    stage: String(stage || 'WORKING').slice(0, 40),
    status: 'WORKING',
    stateEnc: encrypt(plain, DRAFT_AAD),
    sourceIdsEnc: encrypt(JSON.stringify(sourceIds), DRAFT_SOURCES_AAD),
    expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    completedAt: null
  };
  if (draftId) {
    const existing = await prisma.livingUnderstandingDraft.findFirst({ where: { id: draftId, ...scope }, select: { id: true } });
    if (existing) {
      return prisma.livingUnderstandingDraft.update({
        where: { id: draftId },
        data,
        select: {
          id: true,
          stage: true,
          sourceInteractionId: true,
          baselineRevisionId: true,
          baselineRevisionNumber: true,
          updatedAt: true,
          expiresAt: true
        }
      });
    }
  }
  return prisma.livingUnderstandingDraft.create({
    data: { ...scope, ...data },
    select: {
      id: true,
      stage: true,
      sourceInteractionId: true,
      baselineRevisionId: true,
      baselineRevisionNumber: true,
      updatedAt: true,
      expiresAt: true
    }
  });
}

export async function loadLivingUnderstandingDraft(scope: Scope, draftId: string) {
  await requireDatingPerson(scope);
  const row = await prisma.livingUnderstandingDraft.findFirst({
    where: { id: String(draftId || ''), ...scope, status: 'WORKING' },
    select: {
      id: true,
      stage: true,
      stateEnc: true,
      sourceIdsEnc: true,
      sourceInteractionId: true,
      baselineRevisionId: true,
      baselineRevisionNumber: true,
      expiresAt: true
    }
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) throw new Error('The Living Understanding working checkpoint is unavailable or expired.');

  const latest = await latestAuthoritativeRevision(scope);
  if (row.baselineRevisionId) {
    if (latest?.id !== row.baselineRevisionId || latest.revisionNumber !== row.baselineRevisionNumber) {
      throw new Error('The Living Understanding checkpoint baseline is stale. Review the source against the current authoritative revision.');
    }
  } else if (latest) {
    // IT: An unbound experimental checkpoint created before the first authoritative save must never
    // become resumable after v1 exists. This closes the Stage 8.12.15 stale-checkpoint seam.
    throw new Error('This checkpoint predates the current authoritative Living Understanding and cannot be resumed.');
  }
  if (row.sourceInteractionId) await requireSourceReflection(scope, row.sourceInteractionId);

  const sourceIds = JSON.parse(decrypt(row.sourceIdsEnc, DRAFT_SOURCES_AAD));
  if (!Array.isArray(sourceIds) || !sourceIds.length) throw new Error('The Living Understanding checkpoint has invalid provenance.');
  await Promise.all(sourceIds.slice(0, 32).map(id => requireSourceReflection(scope, String(id))));
  const state = normaliseState(JSON.parse(decrypt(row.stateEnc, DRAFT_AAD)));
  if (!state.longitudinalSeed.length) throw new Error('The Living Understanding checkpoint has no usable understanding state.');
  return {
    id: row.id,
    stage: row.stage,
    sourceInteractionId: row.sourceInteractionId,
    baselineRevisionId: row.baselineRevisionId,
    baselineRevisionNumber: row.baselineRevisionNumber,
    ...state
  };
}

export async function completeLivingUnderstandingDraft(scope: Scope, draftId: string) {
  if (!draftId) return;
  const now = new Date();
  await prisma.livingUnderstandingDraft.updateMany({
    where: { id: draftId, ...scope },
    data: { status: 'COMPLETED', completedAt: now, expiresAt: new Date(now.getTime() + 60 * 60 * 1000) }
  });
}

export async function getLatestLivingUnderstandingDraftSummary(scope: Scope) {
  await requireDatingPerson(scope);
  const latest = await latestAuthoritativeRevision(scope);
  const row = await prisma.livingUnderstandingDraft.findFirst({
    where: {
      ...scope,
      status: 'WORKING',
      expiresAt: { gt: new Date() },
      // IT: Once an authoritative baseline exists, never surface old unbound pre-baseline drafts.
      ...(latest
        ? { baselineRevisionId: latest.id, baselineRevisionNumber: latest.revisionNumber }
        : { baselineRevisionId: null })
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      stage: true,
      sourceInteractionId: true,
      baselineRevisionId: true,
      baselineRevisionNumber: true,
      updatedAt: true,
      expiresAt: true
    }
  });
  return row;
}
