// PURPOSE: Read-only operator inspection of Dorian telephone calls and their authoritative LU outcomes.
// SECURITY: Every participant read enters explicit, narrowly permitted cross-owner custody.
import { error } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { decryptInteractionSummary } from '$lib/server/core/interactionEncryption';
import { runWithCrossOwnerWorkspaceCustody, runWithWorkspaceCustody } from '$lib/server/core/contextSpace';
import { PERSON_CONVERSATION_SOURCE_CHANNEL } from '$lib/server/core/conversationIngestion';
import { inspectCompletedAutomaticImpactDraft } from '$lib/server/datingLivingUnderstandingDraft';

// IT: Read-only snapshot of authoritative topics and their actual source relationships.
export type RevisionInspection = {
  revisionNumber: number;
  authorisedAt: Date;
  previousRevisionNumber: number | null;
  changes: Array<{
    realm: string; topic: string; operation: string;
    before: string | null; after: string; changed: boolean;
    sourceInteractionIds: string[];
  }>;
  sourceInteractionIds: string[];
  historicalReviewAvailability: string;
};

const LU_LABEL_AAD = 'dating.living_understanding.label';
const LU_TEXT_AAD = 'dating.living_understanding.text';

// IT: Retrieve only genuine persisted revisions; do not reconstruct discarded model drafts.
async function inspectRevision(scope: { userId: string; contextSpaceId: string; contactId: string }, revisionId: string): Promise<RevisionInspection | null> {
  const selection = {
    id: true, revisionNumber: true, authorisedAt: true, previousRevisionId: true,
    sources: { select: { sourceInteractionId: true } },
    memberships: { select: {
      topicIdentityId: true,
      topicIdentity: { select: { realmNameEnc: true, topicNameEnc: true } },
      topicVersion: { select: { understandingEnc: true, operation: true,
        sources: { select: { sourceInteractionId: true } }
      } }
    } }
  } as const;
  const revision = await prisma.livingUnderstandingRevision.findFirst({
    where: { ...scope, id: revisionId }, select: selection
  });
  if (!revision) return null;
  const previous = revision.previousRevisionId
    ? await prisma.livingUnderstandingRevision.findFirst({
        where: { ...scope, id: revision.previousRevisionId },
        select: { revisionNumber: true, memberships: { select: {
          topicIdentityId: true, topicVersion: { select: { understandingEnc: true } }
        } } }
      })
    : null;
  const prior = new Map(previous?.memberships.map(m => [m.topicIdentityId, decrypt(m.topicVersion.understandingEnc, LU_TEXT_AAD)]) ?? []);
  const changes = revision.memberships.map(m => {
    const before = prior.get(m.topicIdentityId) ?? null;
    const after = decrypt(m.topicVersion.understandingEnc, LU_TEXT_AAD);
    return {
      realm: decrypt(m.topicIdentity.realmNameEnc, LU_LABEL_AAD),
      topic: decrypt(m.topicIdentity.topicNameEnc, LU_LABEL_AAD),
      operation: m.topicVersion.operation,
      before, after, changed: before !== after,
      sourceInteractionIds: m.topicVersion.sources.map(src => src.sourceInteractionId)
    };
  });
  return {
    revisionNumber: revision.revisionNumber,
    authorisedAt: revision.authorisedAt,
    previousRevisionNumber: previous?.revisionNumber ?? null,
    changes,
    sourceInteractionIds: revision.sources.map(src => src.sourceInteractionId),
    historicalReviewAvailability: 'Authoritative snapshots and persisted source attribution are shown. Intermediate semantic or structural review artifacts are not asserted to exist.'
  };
}

type Viewer = { userId: string; contextSpaceId: string };

// SECURITY: A local owner role AND the agent deployment's owning User must match.
export async function requirePilotOperator(locals: App.Locals): Promise<Viewer> {
  if (!locals.user || !locals.contextSpaceId || locals.contextDomainKey !== 'general') throw error(403, 'General operator access required.');
  const user = await prisma.user.findUnique({ where: { id: locals.user.id }, select: { role: true } });
  if (user?.role !== 'owner') throw error(403, 'Pilot operator permission required.');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}

export async function listDorianCalls(viewer: Viewer, requestedId?: string) {
  // SECURITY: Fetch only sessions on deployments owned by the signed-in operator.
  const deployments = await prisma.agentProviderBinding.findMany({
    where: { userId: viewer.userId, contextSpaceId: viewer.contextSpaceId, provider: 'ELEVENLABS' },
    select: { id: true }
  });
  const ids = deployments.map(d => d.id);
  if (!ids.length) return [];
  const sessions = await prisma.networkDorianSession.findMany({
    where: { agentBindingId: { in: ids }, conversationId: { not: null } },
    select: { conversationId: true, userId: true, contextSpaceId: true, contactId: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 250
  });
  const calls = [] as Array<{
    id: string; participantName: string; occurredAt: Date; summary: string; transcript: string;
    status: string; revisionNumber: number | null; revisionId: string | null; contextState: string | null; inspection?: RevisionInspection | null; automaticReview?: Awaited<ReturnType<typeof inspectCompletedAutomaticImpactDraft>>;
  }>;
  const seen = new Set<string>();
  for (const session of sessions) {
    if (!session.conversationId) continue;
    const dedupe = `${session.userId}:${session.conversationId}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    // SECURITY: Never expose another participant's records outside the named read-only transition.
    // SECURITY: The cross-owner transition explicitly rejects same-owner scopes.
    // Use ordinary workspace custody for sessions owned by the operator, including
    // another ContextSpace of that same owner. Cross-owner access remains named and
    // read-only under the PILOT_PHONE_REVIEW policy.
    const enterParticipantCustody = <T>(work: () => Promise<T>) =>
      session.userId === viewer.userId
        ? runWithWorkspaceCustody({ userId: session.userId, contextSpaceId: session.contextSpaceId }, work)
        : runWithCrossOwnerWorkspaceCustody({
            sourceUserId: viewer.userId, targetUserId: session.userId,
            targetContextSpaceId: session.contextSpaceId, reason: 'PILOT_PHONE_REVIEW'
          }, work);
    const row = await enterParticipantCustody(async () => {
      const scope = { userId: session.userId, contextSpaceId: session.contextSpaceId, contactId: session.contactId };
      const [contact, sources] = await Promise.all([
        prisma.contact.findFirst({
          // SECURITY: Contact uses `id`, while Interaction and revision sources use `contactId`.
          // Keep explicit participant custody fields rather than querying by ID alone.
          where: { id: session.contactId, userId: session.userId, contextSpaceId: session.contextSpaceId, linkedUserId: session.userId },
          select: { id: true, fullNameEnc: true }
        }),
        // Conversation excerpts use a random externalRef, so match the provider ID
        // from decrypted, custody-scoped source metadata rather than guessing its index.
        prisma.interaction.findMany({ where: { ...scope, channel: PERSON_CONVERSATION_SOURCE_CHANNEL },
          select: { id: true, occurredAt: true, summaryEnc: true, rawTextEnc: true },
          orderBy: { occurredAt: 'desc' }, take: 250 })
      ]);
      const source = sources.find(candidate => {
        try {
          const payload = JSON.parse(decrypt(candidate.rawTextEnc, 'interaction.raw_text'));
          return payload?.externalConversationId === session.conversationId;
        } catch { return false; }
      });
      if (!source) return null;
      const applied = await prisma.livingUnderstandingRevisionSource.findFirst({
        where: { ...scope, sourceInteractionId: source.id },
        select: { revisionId: true, revision: { select: { revisionNumber: true } } }
      });
      const inspection = requestedId === source.id && applied?.revisionId
        ? await inspectRevision(scope, applied.revisionId) : null;
      // IT: Read the stored automatic impact trace for this source only.
      const automaticReview = requestedId === source.id && applied?.revisionId
        ? await inspectCompletedAutomaticImpactDraft(scope, source.id) : null;
      const participantName = contact ? await contactDisplayName(contact) : 'Unnamed participant';
      let transcript = '';
      try { const payload = JSON.parse(decrypt(source.rawTextEnc, 'interaction.raw_text'));
        transcript = String(payload?.text || '').slice(0, 20000);
      } catch { transcript = 'Transcript unavailable.'; }
      return {
        id: source.id, participantName, occurredAt: source.occurredAt,
        summary: decryptInteractionSummary(source.summaryEnc), transcript,
        status: applied ? 'APPLIED' : 'PENDING',
        revisionNumber: applied?.revision.revisionNumber ?? null,
        revisionId: applied?.revisionId ?? null,
        contextState: null, inspection, automaticReview
      };
    });
    if (row && (!requestedId || row.id === requestedId)) calls.push(row);
  }
  return calls;
}
