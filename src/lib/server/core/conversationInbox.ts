// PURPOSE: Store provider-native conversation originals and explicitly attach participant speech later.
// SECURITY: Parent transcripts are contextual source; only selected User turns become direct participant evidence.
import { createHash } from 'node:crypto';
import { prisma } from '$lib/db';
import { decrypt, encrypt } from '$lib/crypto';
import { speakerSource, type ParsedTranscript } from '$lib/server/datingTranscriptImportPolicy';
import { encryptInteractionSummary } from '$lib/server/core/interactionEncryption';
import {
  buildConversationPayload, conversationExternalRef, CONVERSATION_TRANSCRIPT_CHANNEL,
  PERSON_CONVERSATION_SOURCE_CHANNEL, sourceTypeForConversationIngest,
  type ConversationMetadata
} from './conversationIngestion';

const AAD = 'interaction.raw_text';
type Scope = { userId: string; contextSpaceId: string };

async function requireSpace(scope: Scope, domainKey: string) {
  const space = await prisma.contextSpace.findFirst({ where: { id: scope.contextSpaceId, ownerUserId: scope.userId, domainKey }, select: { id: true } });
  if (!space) throw new Error(`An owned ${domainKey} ContextSpace is required.`);
}

export async function storeConversationOriginal(scope: Scope, domainKey: string, parsed: ParsedTranscript, metadata: ConversationMetadata) {
  await requireSpace(scope, domainKey);
  const fingerprint = createHash('sha256').update(parsed.text).digest('hex');
  const externalRef = conversationExternalRef(metadata, fingerprint);
  const sourceType = sourceTypeForConversationIngest(metadata.ingestMethod);
  const occurredAt = metadata.occurredAt ?? new Date();
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${scope.contextSpaceId}), hashtext(${externalRef}))) AS lock_row`;
    const existing = await tx.interaction.findFirst({ where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, channel: CONVERSATION_TRANSCRIPT_CHANNEL, sourceType, externalRef }, select: { id: true, occurredAt: true } });
    if (existing) return { transcriptId: existing.id, occurredAt: existing.occurredAt, alreadyImported: true };
    const row = await tx.interaction.create({ data: {
      userId: scope.userId, contextSpaceId: scope.contextSpaceId, occurredAt,
      channel: CONVERSATION_TRANSCRIPT_CHANNEL, sourceType, externalRef,
      rawTextEnc: encrypt(JSON.stringify(buildConversationPayload({ text: parsed.text, speakers: parsed.speakers, turns: parsed.turns, metadata })), AAD),
      summaryEnc: metadata.summary ? encryptInteractionSummary(metadata.summary) : null
    }, select: { id: true, occurredAt: true } });
    return { transcriptId: row.id, occurredAt: row.occurredAt, alreadyImported: false };
  }, { timeout: 20000 });
}

export async function attachConversationParticipant(scope: Scope, domainKey: string, transcriptId: string, contactId: string) {
  await requireSpace(scope, domainKey);
  const contact = await prisma.contact.findFirst({ where: { id: contactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId }, select: { id: true } });
  if (!contact) throw new Error('Choose a participant from this ContextSpace.');
  return prisma.$transaction(async tx => {
    const original = await tx.interaction.findFirst({ where: { id: transcriptId, userId: scope.userId, contextSpaceId: scope.contextSpaceId, channel: CONVERSATION_TRANSCRIPT_CHANNEL }, select: { id: true, occurredAt: true, rawTextEnc: true, sourceType: true, summaryEnc: true } });
    if (!original) throw new Error('Conversation is not accessible in this ContextSpace.');
    const payload = JSON.parse(decrypt(original.rawTextEnc, AAD)) as any;
    if (payload?.kind !== 'CONVERSATION_TRANSCRIPT' || !Array.isArray(payload.turns)) throw new Error('Invalid conversation source data.');
    const userTurns = payload.turns.filter((turn: any) => String(turn?.speaker || '').toLowerCase() === 'user');
    if (!userTurns.length) throw new Error('Conversation has no User turns to attach.');
    const externalRef = `conversation:person-source:${original.id}:${contact.id}`;
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${scope.contextSpaceId}), hashtext(${externalRef}))) AS lock_row`;
    const existing = await tx.interaction.findFirst({ where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, sourceType: original.sourceType, externalRef }, select: { id: true, contactId: true } });
    if (existing) return { ...existing, alreadyAttached: true };
    const created = await tx.interaction.create({ data: {
      userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: contact.id,
      occurredAt: original.occurredAt, channel: PERSON_CONVERSATION_SOURCE_CHANNEL,
      sourceType: original.sourceType, externalRef,
      rawTextEnc: encrypt(JSON.stringify({
        version: 2, kind: 'CONVERSATION_EXCERPT', actor: 'OPERATOR',
        text: speakerSource(userTurns, 'User'), touchpointId: null, transcriptId: original.id,
        speaker: 'User', sourceTurnIds: userTurns.map((turn: any) => String(turn.id)),
        provider: String(payload.provider || ''), ingestMethod: String(payload.ingestMethod || ''),
        externalConversationId: payload.externalConversationId ?? null, providerUserId: payload.providerUserId ?? null,
        callerPhone: payload.callerPhone ?? null, conversationVersion: 3
      }), AAD),
      summaryEnc: original.summaryEnc
    }, select: { id: true, contactId: true } });
    return { ...created, alreadyAttached: false };
  }, { timeout: 20000 });
}

export async function listPendingConversations(scope: Scope, domainKey: string) {
  await requireSpace(scope, domainKey);
  const originals = await prisma.interaction.findMany({ where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, channel: CONVERSATION_TRANSCRIPT_CHANNEL, sourceType: 'API' }, select: { id: true, occurredAt: true, rawTextEnc: true }, orderBy: { occurredAt: 'desc' }, take: 50 });
  const result = [] as any[];
  for (const row of originals) {
    const attached = await prisma.interaction.findFirst({ where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, channel: PERSON_CONVERSATION_SOURCE_CHANNEL, externalRef: { startsWith: `conversation:person-source:${row.id}:` } }, select: { id: true } });
    if (attached) continue;
    const payload = JSON.parse(decrypt(row.rawTextEnc, AAD)) as any;
    const userTurns = Array.isArray(payload.turns) ? payload.turns.filter((turn: any) => String(turn?.speaker || '').toLowerCase() === 'user') : [];
    result.push({ id: row.id, occurredAt: row.occurredAt, provider: String(payload.provider || ''), agentName: String(payload.agentName || ''), callerPhone: String(payload.callerPhone || ''), providerUserId: String(payload.providerUserId || ''), turnCount: Array.isArray(payload.turns) ? payload.turns.length : 0, preview: userTurns.slice(0, 2).map((turn: any) => String(turn.text || '')).join(' ').slice(0, 320) });
  }
  return result;
}
