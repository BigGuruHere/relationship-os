// PURPOSE: Retain an encrypted full conversation and create separately reviewable private per-person sources.
// SECURITY: Validate owner, ContextSpace, mappings and all contacts before decrypting or writing anything.
// Stage 8.14.1: provider metadata and stable turn IDs make this the manual adapter for the same
// provider-independent conversation source that direct ElevenLabs ingestion can use next.
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { parseDatingTranscript, speakerSource, validateSpeakerMapping } from './datingTranscriptImportPolicy';
import {
  buildConversationPayload,
  conversationExternalRef,
  CONVERSATION_TRANSCRIPT_CHANNEL,
  PERSON_CONVERSATION_SOURCE_CHANNEL,
  sourceTypeForConversationIngest,
  validateConversationMetadata
} from './core/conversationIngestion';

export type DatingConversationImportMetadata = Parameters<typeof validateConversationMetadata>[0];
type Scope = { userId: string; contextSpaceId: string };

export async function importDatingTranscript(
  scope: Scope,
  raw: unknown,
  mapping: Record<string, string>,
  metadataInput: DatingConversationImportMetadata = {}
) {
  const parsed = parseDatingTranscript(raw);
  const metadata = validateConversationMetadata(metadataInput);
  const space = await prisma.contextSpace.findFirst({
    where: { id: scope.contextSpaceId, ownerUserId: scope.userId, domainKey: 'dating' },
    select: { id: true }
  });
  if (!space) throw new Error('An owned Dating space is required.');

  const mappedContactIds = Object.values(mapping).filter(id => id !== 'SKIP');
  const people = await prisma.contact.findMany({
    where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, id: { in: mappedContactIds } },
    select: { id: true }
  });
  validateSpeakerMapping(parsed.speakers, mapping, new Set(people.map(p => p.id)));

  const excludedSpeakers = parsed.speakers.filter(speaker => mapping[speaker] === 'SKIP');
  const excerpts = parsed.speakers.filter(speaker => mapping[speaker] !== 'SKIP').map(speaker => ({
    contactId: mapping[speaker],
    speaker,
    text: speakerSource(parsed.turns, speaker),
    sourceTurnIds: parsed.turns.filter(turn => turn.speaker === speaker).map(turn => turn.id)
  }));
  if (!excerpts.length || excerpts.length > 50) throw new Error('Import exceeds the 50-person excerpt limit. Divide the transcript.');

  // Content identity includes explicit speaker mapping because the same transcript can be retained
  // for different private participants only when the operator has intentionally chosen that mapping.
  const contentFingerprint = createHash('sha256').update(JSON.stringify({
    importVersion: 3,
    text: parsed.text,
    mapping: parsed.speakers.map(s => [s, mapping[s]])
  })).digest('hex');
  const externalRef = conversationExternalRef(metadata, contentFingerprint);
  // Legacy Stage 8.12 content imports used importVersion 2 and a Dating-specific prefix.
  // Check that identity too so upgrading the ingestion envelope never duplicates an existing source.
  const legacyFingerprint = createHash('sha256').update(JSON.stringify({
    importVersion: 2,
    text: parsed.text,
    mapping: parsed.speakers.map(s => [s, mapping[s]])
  })).digest('hex');
  const legacyExternalRef = `dating:transcript:${legacyFingerprint}`;
  const occurredAt = metadata.occurredAt ?? new Date();
  const sourceType = sourceTypeForConversationIngest(metadata.ingestMethod);

  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${scope.contextSpaceId}), hashtext(${externalRef}))) AS lock_row`;
    const previous = await tx.interaction.findFirst({
      where: {
        userId: scope.userId,
        contextSpaceId: scope.contextSpaceId,
        channel: { in: [CONVERSATION_TRANSCRIPT_CHANNEL, 'DATING_CONVERSATION_TRANSCRIPT'] },
        externalRef: metadata.externalConversationId ? externalRef : { in: [externalRef, legacyExternalRef] }
      },
      select: { id: true }
    });
    if (previous) {
      const existingExcerpts = await tx.interaction.findMany({
        where: {
          userId: scope.userId,
          contextSpaceId: scope.contextSpaceId,
          channel: { in: [PERSON_CONVERSATION_SOURCE_CHANNEL, 'DATING_PERSON_REFLECTION'] },
          externalRef: { startsWith: `conversation:person-source:${previous.id}:` }
        },
        select: { id: true, contactId: true },
        orderBy: { occurredAt: 'asc' }
      });
      // Stage 8.12 legacy imports used a different excerpt prefix. Preserve idempotency across upgrades.
      const legacyExcerpts = existingExcerpts.length ? [] : await tx.interaction.findMany({
        where: {
          userId: scope.userId,
          contextSpaceId: scope.contextSpaceId,
          channel: 'DATING_PERSON_REFLECTION',
          externalRef: { startsWith: `dating:transcript-excerpt:${previous.id}:` }
        },
        select: { id: true, contactId: true },
        orderBy: { occurredAt: 'asc' }
      });
      const found = existingExcerpts.length ? existingExcerpts : legacyExcerpts;
      return {
        transcriptId: previous.id,
        excerpts: found.map(excerpt => ({
          ...excerpt,
          speaker: parsed.speakers.find(speaker => mapping[speaker] === excerpt.contactId) ?? 'Unknown speaker'
        })),
        alreadyImported: true,
        excludedSpeakers,
        provider: metadata.provider,
        ingestMethod: metadata.ingestMethod,
        turnCount: parsed.turns.length
      };
    }

    const original = await tx.interaction.create({
      data: {
        userId: scope.userId,
        contextSpaceId: scope.contextSpaceId,
        occurredAt,
        channel: CONVERSATION_TRANSCRIPT_CHANNEL,
        sourceType,
        externalRef,
        rawTextEnc: encrypt(JSON.stringify(buildConversationPayload({
          text: parsed.text,
          speakers: parsed.speakers,
          turns: parsed.turns,
          metadata
        })), 'interaction.raw_text')
      },
      select: { id: true }
    });

    const created: { id: string; contactId: string | null; speaker: string }[] = [];
    for (const excerpt of excerpts) {
      // No speaker shares another speaker's evidence. The full parent transcript is contextual source only.
      const result = await tx.interaction.create({
        data: {
          userId: scope.userId,
          contextSpaceId: scope.contextSpaceId,
          contactId: excerpt.contactId,
          occurredAt,
          channel: PERSON_CONVERSATION_SOURCE_CHANNEL,
          sourceType,
          externalRef: `conversation:person-source:${original.id}:${randomUUID()}`,
          rawTextEnc: encrypt(JSON.stringify({
            version: 2,
            kind: 'CONVERSATION_EXCERPT',
            actor: 'OPERATOR',
            text: excerpt.text,
            touchpointId: null,
            transcriptId: original.id,
            speaker: excerpt.speaker,
            sourceTurnIds: excerpt.sourceTurnIds,
            provider: metadata.provider,
            ingestMethod: metadata.ingestMethod,
            externalConversationId: metadata.externalConversationId,
            conversationVersion: 3
          }), 'interaction.raw_text')
        },
        select: { id: true, contactId: true }
      });
      created.push({ ...result, speaker: excerpt.speaker });
    }

    return {
      transcriptId: original.id,
      excerpts: created,
      alreadyImported: false,
      excludedSpeakers,
      provider: metadata.provider,
      ingestMethod: metadata.ingestMethod,
      turnCount: parsed.turns.length
    };
  }, { timeout: 20000 });
}
