// Stage 8.13.0 - authoritative longitudinal Living Understanding persistence.
// SECURITY: authoritative text remains encrypted. Revision snapshots are immutable, topic versions
// are immutable, and every source is re-authorised inside the persistence transaction.
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '$lib/db';
import { encrypt, decrypt, buildScopedIndexToken, buildScopedMacToken } from '$lib/crypto';
import { requireDatingPerson, type Scope } from './datingUnderstandingTopics';
import { requireSourceReflection } from './datingLivingUnderstanding';

const TOKEN_SCOPE = 'dating:living-understanding:adoption:v1';
const LABEL_AAD = 'dating.living_understanding.label';
const TEXT_AAD = 'dating.living_understanding.text';
const MAX_TOKEN_AGE_MS = 2 * 60 * 60 * 1000;
const ADOPTION_TRANSACTION_TIMEOUT_MS = 15_000;

export type LivingUnderstandingTemporalScope = 'CURRENT' | 'HISTORICAL' | 'MIXED';

type AdoptTopic = {
  realm: string;
  topicName: string;
  proposedUnderstanding: string;
  temporalScope: LivingUnderstandingTemporalScope;
  operation: string;
  sourceTargetKeys: string[];
  sourceInteractionIds: string[];
};

type AdoptPayload = {
  version: 1;
  userId: string;
  contextSpaceId: string;
  contactId: string;
  issuedAt: string;
  topics: AdoptTopic[];
};

export type LivingUnderstandingTopicChange = {
  topicIdentityId: string;
  proposedUnderstanding: string;
  temporalScope: LivingUnderstandingTemporalScope;
  operation: string;
  sourceInteractionIds: string[];
  relationshipType?: 'INFORMED' | 'REINFORCED';
};

export type LivingUnderstandingNewTopic = {
  realm: string;
  topicName: string;
  proposedUnderstanding: string;
  temporalScope: LivingUnderstandingTemporalScope;
  operation: string;
  sourceInteractionIds: string[];
  relationshipType?: 'INFORMED' | 'REINFORCED';
};

export type PersistLongitudinalRevisionInput = {
  baselineRevisionId: string | null;
  adoptionKey: string;
  revisionSourceIds: string[];
  changes: LivingUnderstandingTopicChange[];
  newTopics: LivingUnderstandingNewTopic[];
};

function cleanLabel(value: unknown, max = 120) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > max) throw new Error('Living Understanding topic labels are invalid.');
  return text;
}

function cleanUnderstanding(value: unknown) {
  const text = String(value ?? '').trim();
  if (text.length < 20 || text.length > 6500) throw new Error('Living Understanding text is invalid.');
  return text;
}

function cleanTemporalScope(value: unknown): LivingUnderstandingTemporalScope {
  return ['CURRENT', 'HISTORICAL', 'MIXED'].includes(String(value))
    ? String(value) as LivingUnderstandingTemporalScope
    : 'CURRENT';
}

function uniqueIds(values: unknown, max = 32) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))].slice(0, max);
}

function tokenParts(token: string) {
  const [payloadB64, mac] = String(token || '').split('.');
  if (!payloadB64 || !/^[a-f0-9]{64}$/i.test(mac || '')) throw new Error('The adoption approval is invalid or expired.');
  const expected = buildScopedMacToken(payloadB64, TOKEN_SCOPE);
  const a = Buffer.from(mac, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('The adoption approval is invalid or expired.');
  let payload: AdoptPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new Error('The adoption approval is invalid or expired.');
  }
  return { payload, payloadB64, mac: expected };
}

export function createLivingUnderstandingAdoptionToken(scope: Scope, restructuring: any) {
  if (!restructuring?.analysis?.validForReview || restructuring.analysis.errors?.length) {
    throw new Error('Only a fully validated Living Understanding proposal can be approved.');
  }
  const sourceByKey = new Map((restructuring.priorSeeds ?? []).map((seed: any) => [String(seed.targetKey), seed]));
  const topics: AdoptTopic[] = (restructuring.analysis.proposedTopics ?? []).map((topic: any) => {
    const sources = (topic.sourceTargetKeys ?? []).map((key: string) => sourceByKey.get(String(key))).filter(Boolean) as any[];
    const sourceInteractionIds = [...new Set(sources.flatMap(seed => Array.isArray(seed.sourceInteractionIds) && seed.sourceInteractionIds.length
      ? seed.sourceInteractionIds.map(String)
      : [String(seed.sourceInteractionId || '')]).filter(Boolean))].slice(0, 24);
    return {
      realm: cleanLabel(topic.realm),
      topicName: cleanLabel(topic.topicName),
      proposedUnderstanding: cleanUnderstanding(topic.proposedUnderstanding),
      temporalScope: cleanTemporalScope(topic.temporalScope),
      operation: String(topic.operation || 'KEEP').slice(0, 24),
      sourceTargetKeys: [...new Set((topic.sourceTargetKeys ?? []).map(String).filter(Boolean))].slice(0, 24),
      sourceInteractionIds
    };
  });
  if (!topics.length || topics.length > 40 || topics.some(topic => !topic.sourceInteractionIds.length)) {
    throw new Error('The validated proposal does not have complete source provenance.');
  }
  const payload: AdoptPayload = { version: 1, ...scope, issuedAt: new Date().toISOString(), topics };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  if (payloadB64.length > 120000) throw new Error('The validated proposal is too large to approve in one revision.');
  const mac = buildScopedMacToken(payloadB64, TOKEN_SCOPE);
  return `${payloadB64}.${mac}`;
}

export function describeLivingUnderstandingPersistenceError(err: unknown) {
  const value = err && typeof err === 'object' ? err as Record<string, any> : {};
  const code = typeof value.code === 'string' && /^P\d{4}$/.test(value.code) ? value.code : '';
  const meta = value.meta && typeof value.meta === 'object' ? value.meta as Record<string, any> : {};
  const safeMeta = [
    typeof meta.modelName === 'string' ? `model=${meta.modelName}` : '',
    typeof meta.field_name === 'string' ? `field=${meta.field_name}` : '',
    typeof meta.constraint === 'string' ? `constraint=${meta.constraint}` : '',
    Array.isArray(meta.target) ? `target=${meta.target.map(String).join(',')}` : ''
  ].filter(Boolean).join(' ');
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown persistence error');
  // SECURITY: keep development diagnostics useful without echoing encrypted payloads, SQL text,
  // filesystem paths or arbitrary database detail back into the browser.
  const concise = raw.split(/\r?\n/).map(line => line.trim()).filter(line =>
    line && !line.startsWith('Invalid `') && !line.startsWith('at ') && !line.includes('src/lib/')
  ).slice(-3).join(' ').replace(/\s+/g, ' ').slice(0, 500);
  return [code, safeMeta, concise].filter(Boolean).join(' · ') || 'Unknown persistence error';
}

/**
 * Persist one immutable longitudinal revision.
 *
 * IT: The caller supplies only changed existing topics and genuinely new topics. Every unchanged
 * baseline membership is copied forward server-side, so an AI omission cannot accidentally delete
 * an unrelated topic from the authoritative snapshot.
 */
export async function persistLongitudinalLivingUnderstandingRevision(scope: Scope, rawInput: PersistLongitudinalRevisionInput) {
  await requireDatingPerson(scope);
  const adoptionKey = String(rawInput?.adoptionKey || '').trim();
  if (adoptionKey.length < 16 || adoptionKey.length > 160) throw new Error('The Living Understanding adoption key is invalid.');

  const revisionSourceIds = uniqueIds(rawInput?.revisionSourceIds, 32);
  const changes = (Array.isArray(rawInput?.changes) ? rawInput.changes : []).slice(0, 40).map(change => ({
    topicIdentityId: String(change.topicIdentityId || ''),
    proposedUnderstanding: cleanUnderstanding(change.proposedUnderstanding),
    temporalScope: cleanTemporalScope(change.temporalScope),
    operation: String(change.operation || 'REFINED').slice(0, 24),
    sourceInteractionIds: uniqueIds(change.sourceInteractionIds, 24),
    relationshipType: change.relationshipType === 'REINFORCED' ? 'REINFORCED' as const : 'INFORMED' as const
  }));
  const newTopics = (Array.isArray(rawInput?.newTopics) ? rawInput.newTopics : []).slice(0, 40).map(topic => ({
    realm: cleanLabel(topic.realm),
    topicName: cleanLabel(topic.topicName),
    proposedUnderstanding: cleanUnderstanding(topic.proposedUnderstanding),
    temporalScope: cleanTemporalScope(topic.temporalScope),
    operation: String(topic.operation || 'NEW_TOPIC').slice(0, 24),
    sourceInteractionIds: uniqueIds(topic.sourceInteractionIds, 24),
    relationshipType: topic.relationshipType === 'REINFORCED' ? 'REINFORCED' as const : 'INFORMED' as const
  }));

  if (!changes.length && !newTopics.length) throw new Error('A new authoritative revision requires at least one affected or new topic.');
  if (changes.some(change => !change.topicIdentityId || !change.sourceInteractionIds.length) || newTopics.some(topic => !topic.sourceInteractionIds.length)) {
    throw new Error('Every changed or new topic must retain source provenance.');
  }
  if (new Set(changes.map(change => change.topicIdentityId)).size !== changes.length) {
    throw new Error('A topic can be changed only once in an authoritative revision.');
  }

  const allSourceIds = [...new Set([
    ...revisionSourceIds,
    ...changes.flatMap(change => change.sourceInteractionIds),
    ...newTopics.flatMap(topic => topic.sourceInteractionIds)
  ])];
  if (!allSourceIds.length) throw new Error('An authoritative revision requires source provenance.');

  return prisma.$transaction(async tx => {
    // IT: Idempotency is checked before stale-baseline detection so an exact repeat of a successful
    // request returns the already-created revision instead of failing because that revision is now current.
    const existing = await tx.livingUnderstandingRevision.findUnique({
      where: { adoptionKey },
      select: { id: true, revisionNumber: true }
    });
    if (existing) return { ...existing, alreadyAdopted: true };

    // SECURITY: Re-authorise every source inside the same transaction as the authoritative write.
    const sources = await Promise.all(allSourceIds.map(id => requireSourceReflection(scope, id, tx)));
    const sourceDates = new Map(sources.map(source => [source.id, source.at]));

    const latest = await tx.livingUnderstandingRevision.findFirst({
      where: scope,
      orderBy: { revisionNumber: 'desc' },
      select: { id: true, revisionNumber: true }
    });
    const expectedBaselineId = rawInput.baselineRevisionId ? String(rawInput.baselineRevisionId) : null;
    if ((latest?.id ?? null) !== expectedBaselineId) {
      throw new Error('STALE_BASELINE: The Living Understanding changed after this review began.');
    }

    const baselineMemberships = latest ? await tx.livingUnderstandingRevisionTopic.findMany({
      where: { ...scope, revisionId: latest.id },
      orderBy: { position: 'asc' },
      select: { topicIdentityId: true, topicVersionId: true, position: true }
    }) : [];
    const baselineByIdentity = new Map(baselineMemberships.map(row => [row.topicIdentityId, row]));
    for (const change of changes) {
      if (!baselineByIdentity.has(change.topicIdentityId)) {
        throw new Error('A proposed topic change does not belong to the authoritative baseline.');
      }
    }

    const revision = await tx.livingUnderstandingRevision.create({
      data: {
        ...scope,
        revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        adoptionKey,
        previousRevisionId: latest?.id ?? null
      },
      select: { id: true, revisionNumber: true }
    });

    // IT: RevisionSource records the source(s) that caused this revision event. It does not imply
    // that every topic version in the snapshot was informed by those sources.
    for (const sourceId of revisionSourceIds) {
      const sourceObservedAt = sourceDates.get(sourceId);
      if (!sourceObservedAt) throw new Error('Authorised revision source provenance could not be resolved.');
      await tx.livingUnderstandingRevisionSource.create({
        data: { ...scope, revisionId: revision.id, sourceInteractionId: sourceId, sourceObservedAt }
      });
    }

    const changeByIdentity = new Map(changes.map(change => [change.topicIdentityId, change]));
    let nextPosition = 0;

    // IT: Baseline topics are exhaustive. Unchanged topics reuse the exact prior topicVersionId;
    // affected topics alone receive a new immutable topic version.
    for (const prior of baselineMemberships) {
      const change = changeByIdentity.get(prior.topicIdentityId);
      if (!change) {
        await tx.livingUnderstandingRevisionTopic.create({
          data: {
            ...scope,
            revisionId: revision.id,
            topicIdentityId: prior.topicIdentityId,
            topicVersionId: prior.topicVersionId,
            position: nextPosition++
          }
        });
        continue;
      }

      const latestTopicVersion = await tx.livingUnderstandingTopicVersion.findFirst({
        where: { ...scope, topicIdentityId: prior.topicIdentityId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true }
      });
      const topicVersion = await tx.livingUnderstandingTopicVersion.create({
        data: {
          ...scope,
          topicIdentityId: prior.topicIdentityId,
          versionNumber: (latestTopicVersion?.versionNumber ?? 0) + 1,
          createdInRevisionId: revision.id,
          understandingEnc: encrypt(change.proposedUnderstanding, TEXT_AAD),
          temporalScope: change.temporalScope,
          operation: change.operation
        },
        select: { id: true }
      });
      for (const sourceId of change.sourceInteractionIds) {
        const sourceObservedAt = sourceDates.get(sourceId);
        if (!sourceObservedAt) throw new Error('Authorised topic source provenance could not be resolved.');
        await tx.livingUnderstandingTopicVersionSource.create({
          data: {
            ...scope,
            topicVersionId: topicVersion.id,
            sourceInteractionId: sourceId,
            sourceObservedAt,
            relationshipType: change.relationshipType
          }
        });
      }
      await tx.livingUnderstandingRevisionTopic.create({
        data: {
          ...scope,
          revisionId: revision.id,
          topicIdentityId: prior.topicIdentityId,
          topicVersionId: topicVersion.id,
          position: nextPosition++
        }
      });
    }

    for (const topic of newTopics) {
      const nameIdx = buildScopedIndexToken(`${topic.realm}\n${topic.topicName}`, 'dating:living-understanding:topic-identity');
      const identity = await tx.livingUnderstandingTopicIdentity.upsert({
        where: { userId_contextSpaceId_contactId_nameIdx: { ...scope, nameIdx } },
        create: {
          ...scope,
          nameIdx,
          realmNameEnc: encrypt(topic.realm, LABEL_AAD),
          topicNameEnc: encrypt(topic.topicName, LABEL_AAD)
        },
        update: {},
        select: { id: true }
      });
      if (baselineByIdentity.has(identity.id) || changeByIdentity.has(identity.id)) {
        throw new Error('A proposed new topic already exists in the authoritative baseline.');
      }
      const latestTopicVersion = await tx.livingUnderstandingTopicVersion.findFirst({
        where: { ...scope, topicIdentityId: identity.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true }
      });
      const topicVersion = await tx.livingUnderstandingTopicVersion.create({
        data: {
          ...scope,
          topicIdentityId: identity.id,
          versionNumber: (latestTopicVersion?.versionNumber ?? 0) + 1,
          createdInRevisionId: revision.id,
          understandingEnc: encrypt(topic.proposedUnderstanding, TEXT_AAD),
          temporalScope: topic.temporalScope,
          operation: topic.operation
        },
        select: { id: true }
      });
      for (const sourceId of topic.sourceInteractionIds) {
        const sourceObservedAt = sourceDates.get(sourceId);
        if (!sourceObservedAt) throw new Error('Authorised topic source provenance could not be resolved.');
        await tx.livingUnderstandingTopicVersionSource.create({
          data: {
            ...scope,
            topicVersionId: topicVersion.id,
            sourceInteractionId: sourceId,
            sourceObservedAt,
            relationshipType: topic.relationshipType
          }
        });
      }
      await tx.livingUnderstandingRevisionTopic.create({
        data: {
          ...scope,
          revisionId: revision.id,
          topicIdentityId: identity.id,
          topicVersionId: topicVersion.id,
          position: nextPosition++
        }
      });
    }

    return { ...revision, alreadyAdopted: false };
  }, { timeout: ADOPTION_TRANSACTION_TIMEOUT_MS });
}

/**
 * Legacy experiment adoption remains available only for creating the first authoritative snapshot.
 * Stage 8.13 longitudinal updates must use persistLongitudinalLivingUnderstandingRevision so that
 * unchanged topic versions are carried forward rather than regenerated.
 */
export async function adoptLivingUnderstanding(scope: Scope, token: string) {
  await requireDatingPerson(scope);
  const { payload, payloadB64, mac } = tokenParts(token);
  if (payload.version !== 1 || payload.userId !== scope.userId || payload.contextSpaceId !== scope.contextSpaceId || payload.contactId !== scope.contactId) {
    throw new Error('The adoption approval does not belong to this person and Dating space.');
  }
  const issued = new Date(payload.issuedAt).getTime();
  if (!Number.isFinite(issued) || Date.now() - issued > MAX_TOKEN_AGE_MS || issued - Date.now() > 60_000) {
    throw new Error('The adoption approval has expired. Run the structural review again.');
  }
  if (!Array.isArray(payload.topics) || !payload.topics.length || payload.topics.length > 40) {
    throw new Error('The adoption approval contains no valid topics.');
  }

  const current = await getCurrentLivingUnderstanding(scope);
  if (current) {
    throw new Error('An authoritative Living Understanding already exists. Review new evidence against the current revision instead of rebuilding it.');
  }

  const topics = payload.topics.map(topic => ({
    realm: cleanLabel(topic.realm),
    topicName: cleanLabel(topic.topicName),
    proposedUnderstanding: cleanUnderstanding(topic.proposedUnderstanding),
    temporalScope: cleanTemporalScope(topic.temporalScope),
    operation: String(topic.operation || 'KEEP').slice(0, 24),
    sourceInteractionIds: uniqueIds(topic.sourceInteractionIds, 24)
  }));
  if (topics.some(topic => !topic.sourceInteractionIds.length)) throw new Error('Every persisted topic must retain source provenance.');

  const allSourceIds = [...new Set(topics.flatMap(topic => topic.sourceInteractionIds))];
  const adoptionKey = buildScopedMacToken(payloadB64, `${TOKEN_SCOPE}:adopted:${mac}`);
  return persistLongitudinalLivingUnderstandingRevision(scope, {
    baselineRevisionId: null,
    adoptionKey,
    revisionSourceIds: allSourceIds,
    changes: [],
    newTopics: topics
  });
}

export async function getCurrentLivingUnderstanding(scope: Scope) {
  await requireDatingPerson(scope);
  const revision = await prisma.livingUnderstandingRevision.findFirst({
    where: scope,
    orderBy: { revisionNumber: 'desc' },
    select: {
      id: true,
      revisionNumber: true,
      previousRevisionId: true,
      authorisedAt: true,
      memberships: {
        orderBy: { position: 'asc' },
        select: {
          topicIdentityId: true,
          topicVersionId: true,
          position: true,
          topicIdentity: { select: { realmNameEnc: true, topicNameEnc: true } },
          topicVersion: {
            select: {
              versionNumber: true,
              temporalScope: true,
              operation: true,
              understandingEnc: true,
              sources: {
                orderBy: { sourceObservedAt: 'asc' },
                select: { sourceInteractionId: true, sourceObservedAt: true, relationshipType: true }
              }
            }
          }
        }
      },
      sources: {
        select: { sourceInteractionId: true, sourceObservedAt: true },
        orderBy: { sourceObservedAt: 'asc' }
      }
    }
  });
  if (!revision) return null;
  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    previousRevisionId: revision.previousRevisionId,
    authorisedAt: revision.authorisedAt,
    topics: revision.memberships.map(row => ({
      id: row.topicVersionId,
      topicVersionId: row.topicVersionId,
      topicVersionNumber: row.topicVersion.versionNumber,
      topicIdentityId: row.topicIdentityId,
      position: row.position,
      realm: decrypt(row.topicIdentity.realmNameEnc, LABEL_AAD),
      topicName: decrypt(row.topicIdentity.topicNameEnc, LABEL_AAD),
      understanding: decrypt(row.topicVersion.understandingEnc, TEXT_AAD),
      temporalScope: row.topicVersion.temporalScope,
      operation: row.topicVersion.operation,
      sources: row.topicVersion.sources
    })),
    sources: revision.sources
  };
}

// IT: Stage 8.13 production analysis should call this baseline loader rather than rebuilding an
// inventory from UnderstandingTopic or browser-carried experiment state.
export const getAuthoritativeLivingUnderstandingBaseline = getCurrentLivingUnderstanding;

export async function listLivingUnderstandingRevisionHistory(scope: Scope) {
  await requireDatingPerson(scope);
  const revisions = await prisma.livingUnderstandingRevision.findMany({
    where: scope,
    orderBy: { revisionNumber: 'desc' },
    select: {
      id: true,
      revisionNumber: true,
      previousRevisionId: true,
      authorisedAt: true,
      _count: { select: { memberships: true, sources: true, createdTopicVersions: true } }
    },
    take: 20
  });
  // IT: Preserve the existing UI's `_count.topics` contract while the underlying snapshot relation
  // is now correctly named `memberships`. `createdTopicVersions` exposes how many topics actually changed.
  return revisions.map(revision => ({
    ...revision,
    _count: {
      topics: revision._count.memberships,
      memberships: revision._count.memberships,
      sources: revision._count.sources,
      createdTopicVersions: revision._count.createdTopicVersions
    }
  }));
}
