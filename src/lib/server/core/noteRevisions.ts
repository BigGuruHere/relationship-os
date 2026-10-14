// IT: Keep a single user-visible note while retaining each encrypted correction as historical evidence.
// The correction-of marker is an existing Stage 8.15.3 source link, not a new identity or permission.
import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/db';
import type { CoreAccessContext } from '$lib/server/core/accessPolicy';
import { createCoreInteraction, loadCoreInteraction } from '$lib/server/core/interactions';

export const noteParentId = (ref: string | null | undefined) =>
  /^correction-of:([0-9a-f-]{36}):[0-9a-f-]{36}$/i.exec(ref ?? '')?.[1] ?? null;

type NoteRow = { id: string; externalRef: string | null; createdAt: Date };

// IT: Resolve a chain of revisions within one already-authorised contact, including legacy corrections.
export function groupCurrentNotes<T extends NoteRow>(rows: T[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const rootOf = (id: string) => {
    const seen = new Set<string>();
    let current = id;
    while (!seen.has(current)) {
      seen.add(current);
      const parent = noteParentId(byId.get(current)?.externalRef);
      if (!parent || !byId.has(parent)) break;
      current = parent;
    }
    return current;
  };
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const root = rootOf(row.id);
    groups.set(root, [...(groups.get(root) ?? []), row]);
  }
  return [...groups.values()].map((versions) => {
    // IT: createdAt expresses revision ordering; occurredAt continues to mean event time.
    versions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    return { current: versions[versions.length - 1], versions };
  });
}

export async function loadNoteRevisionState(context: CoreAccessContext, contactId: string, noteId: string) {
  const rows = await prisma.interaction.findMany({
    where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId },
    select: { id: true, externalRef: true, createdAt: true }
  });
  const group = groupCurrentNotes(rows).find(({ versions }) => versions.some((v) => v.id === noteId));
  return group ?? null;
}

export async function saveCurrentNoteCorrection(context: CoreAccessContext, contactId: string, noteId: string, input: {
  rawText: string; channel?: string; occurredAt?: Date | null;
}) {
  const revision = await loadNoteRevisionState(context, contactId, noteId);
  if (!revision || revision.current.id !== noteId) throw new Error('This note has a newer version. Refresh before editing.');
  const original = await loadCoreInteraction(context, noteId);
  if (!original || original.contactId !== contactId) throw new Error('Note not found.');
  // IT: A correction inherits the current note's LU admission choice.
  const admission = await prisma.interaction.findFirst({
    where: { id: noteId, contactId, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId },
    select: { luAdmission: true }
  });
  const corrected = await createCoreInteraction(context, {
    contactId, channel: input.channel ?? original.channel, rawText: input.rawText,
    luAdmission: admission?.luAdmission === 'ELIGIBLE' ? 'ELIGIBLE' : 'STORED_ONLY',
    occurredAt: input.occurredAt ?? original.occurredAt, sourceType: 'WORKSPACE',
    externalRef: `correction-of:${original.id}:${randomUUID()}`
  });
  // IT: A superseded source no longer counts as active support for a claim.
  // Never rewrite an authoritative LU revision or delete its immutable evidence.
  await prisma.$transaction(async (tx) => {
    await tx.knowledgeEvidence.updateMany({
      where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, sourceInteractionId: original.id, status: 'ACTIVE' },
      data: { status: 'SUPERSEDED' }
    });
    const affected = await tx.knowledgeEvidence.findMany({
      where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, sourceInteractionId: original.id },
      select: { claimId: true }
    });
    for (const { claimId } of affected) {
      const active = await tx.knowledgeEvidence.count({ where: { claimId, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, status: 'ACTIVE' } });
      if (!active) await tx.knowledgeClaim.updateMany({
        where: { id: claimId, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED' }
      });
    }
  });
  return corrected;
}

// IT: Control LU admission across an entire note correction chain, not merely its visible revision.
// Existing authoritative LU cannot be unwound by flipping a switch: reject instead.
export async function changeNoteLivingUnderstandingAdmission(
  context: CoreAccessContext, contactId: string, noteId: string, requested: 'ELIGIBLE' | 'STORED_ONLY'
) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.interaction.findMany({
      where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId },
      select: { id: true, externalRef: true, createdAt: true, luAdmission: true }
    });
    const group = groupCurrentNotes(rows).find(({ versions }) => versions.some((version) => version.id === noteId));
    if (!group || group.current.id !== noteId) throw new Error('Open the current note before changing admission.');
    const ids = group.versions.map((version) => version.id);
    const authoritative = await tx.livingUnderstandingRevisionSource.count({
      where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId, sourceInteractionId: { in: ids } }
    });
    if (requested !== 'ELIGIBLE' && authoritative > 0) {
      throw new Error('This note has already contributed to approved Living Understanding. Its removal requires a reviewed LU reassessment. No change was made.');
    }
    // IT: WITHDRAWN records a previously permitted source being excluded. STORED_ONLY remains the initial opt-out.
    const wasEligible = group.versions.some((version) => version.luAdmission === 'ELIGIBLE');
    const state = requested === 'ELIGIBLE' ? 'ELIGIBLE' : wasEligible ? 'WITHDRAWN' : 'STORED_ONLY';
    await tx.interaction.updateMany({
      where: { id: { in: ids }, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId },
      data: { luAdmission: state }
    });
    return state;
  });
}
