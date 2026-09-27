// PURPOSE: Retain an encrypted full transcript and create separately reviewable private per-person source excerpts.
// SECURITY: Validate owner, ContextSpace, mappings and all contacts before decrypting or writing anything.
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { parseDatingTranscript, speakerExcerptChunks, validateSpeakerMapping } from './datingTranscriptImportPolicy';

type Scope = { userId: string; contextSpaceId: string };
export async function importDatingTranscript(scope: Scope, raw: unknown, mapping: Record<string, string>) {
  const parsed = parseDatingTranscript(raw);
  const space = await prisma.contextSpace.findFirst({ where: { id: scope.contextSpaceId, ownerUserId: scope.userId, domainKey: 'dating' }, select: { id: true } });
  if (!space) throw new Error('An owned Dating space is required.');
  const people = await prisma.contact.findMany({ where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, id: { in: Object.values(mapping).filter(id => id !== 'SKIP') } }, select: { id: true } });
  validateSpeakerMapping(parsed.speakers, mapping, new Set(people.map(p => p.id)));
  // A skipped speaker remains in the original transcript but receives no private excerpt.
  const excludedSpeakers = parsed.speakers.filter(speaker => mapping[speaker] === 'SKIP');
  const excerpts = parsed.speakers.filter(speaker => mapping[speaker] !== 'SKIP').flatMap(speaker =>
    speakerExcerptChunks(parsed.turns, speaker).map((text, index) => ({ contactId: mapping[speaker], speaker, text, index })));
  if (!excerpts.length || excerpts.length > 50) throw new Error('Import exceeds the 50 excerpt limit. Divide the transcript.');
  // Idempotency is scoped to the owner and space as well as exact transcript and explicit mapping.
  const fingerprint = createHash('sha256').update(JSON.stringify({ text: parsed.text, mapping: parsed.speakers.map(s => [s, mapping[s]]) })).digest('hex');
  const externalRef = `dating:transcript:${fingerprint}`;
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${scope.contextSpaceId}), hashtext(${fingerprint}))) AS lock_row`;
    const previous = await tx.interaction.findFirst({ where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, channel: 'DATING_CONVERSATION_TRANSCRIPT', externalRef }, select: { id: true } });
    if (previous) {
      const existingExcerpts = await tx.interaction.findMany({ where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, channel: 'DATING_PERSON_REFLECTION', externalRef: { startsWith: `dating:transcript-excerpt:${previous.id}:` } }, select: { id: true, contactId: true }, orderBy: { occurredAt: 'asc' } });
      return { transcriptId: previous.id, excerpts: existingExcerpts.map(excerpt => ({ ...excerpt, speaker: parsed.speakers.find(speaker => mapping[speaker] === excerpt.contactId) ?? 'Unknown speaker' })), alreadyImported: true, excludedSpeakers };
    }
    const original = await tx.interaction.create({ data: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, channel: 'DATING_CONVERSATION_TRANSCRIPT', sourceType: 'WORKSPACE', externalRef,
      rawTextEnc: encrypt(JSON.stringify({ version: 1, kind: 'CONVERSATION_TRANSCRIPT', text: parsed.text, speakers: parsed.speakers, importedBy: 'OPERATOR' }), 'interaction.raw_text') }, select: { id: true } });
    const created: { id: string; contactId: string | null; speaker: string }[] = [];
    for (const excerpt of excerpts) {
      // No speaker shares another speaker's evidence. The parent transcript is never a proposal source.
      const result = await tx.interaction.create({ data: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: excerpt.contactId,
        channel: 'DATING_PERSON_REFLECTION', sourceType: 'WORKSPACE', externalRef: `dating:transcript-excerpt:${original.id}:${randomUUID()}`,
        rawTextEnc: encrypt(JSON.stringify({ version: 1, kind: 'CONVERSATION_EXCERPT', actor: 'OPERATOR', text: excerpt.text, touchpointId: null, transcriptId: original.id, speaker: excerpt.speaker, chunkIndex: excerpt.index }), 'interaction.raw_text') }, select: { id: true, contactId: true } });
      created.push({ ...result, speaker: excerpt.speaker });
    }
    return { transcriptId: original.id, excerpts: created, alreadyImported: false, excludedSpeakers };
  }, { timeout: 20000 });
}
