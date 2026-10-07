// PURPOSE: Provider-independent conversation source metadata and stable source identity.
// SECURITY: Provider identifiers are metadata only. External conversation IDs are hashed before
// they are placed in Interaction.externalRef so provider IDs are not exposed in plaintext indexes.
import { createHash } from 'node:crypto';

export const CONVERSATION_TRANSCRIPT_CHANNEL = 'CONVERSATION_TRANSCRIPT';
export const PERSON_CONVERSATION_SOURCE_CHANNEL = 'PERSON_CONVERSATION_SOURCE';
export const LEGACY_DATING_CONVERSATION_TRANSCRIPT_CHANNEL = 'DATING_CONVERSATION_TRANSCRIPT';
export const LEGACY_DATING_PERSON_REFLECTION_CHANNEL = 'DATING_PERSON_REFLECTION';

export const CONVERSATION_PROVIDERS = ['ELEVENLABS', 'MANUAL', 'OTHER'] as const;
export type ConversationProvider = typeof CONVERSATION_PROVIDERS[number];

export const CONVERSATION_INGEST_METHODS = [
  'MANUAL_PASTE',
  'FILE_UPLOAD',
  'ELEVENLABS_WEBHOOK',
  'ELEVENLABS_API',
  'OTHER'
] as const;
export type ConversationIngestMethod = typeof CONVERSATION_INGEST_METHODS[number];

export type StoredConversationTurn = {
  id: string;
  speaker: string;
  text: string;
};

export type ConversationMetadata = {
  provider: ConversationProvider;
  ingestMethod: ConversationIngestMethod;
  externalConversationId: string | null;
  agentName: string | null;
  occurredAt: Date | null;
};

function cleanOptional(value: unknown, max: number) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

export function validateConversationMetadata(input: {
  provider?: unknown;
  ingestMethod?: unknown;
  externalConversationId?: unknown;
  agentName?: unknown;
  occurredAt?: unknown;
} = {}): ConversationMetadata {
  const providerValue = String(input.provider ?? 'ELEVENLABS').trim().toUpperCase();
  const provider = CONVERSATION_PROVIDERS.includes(providerValue as ConversationProvider)
    ? providerValue as ConversationProvider
    : 'OTHER';

  const methodValue = String(input.ingestMethod ?? 'MANUAL_PASTE').trim().toUpperCase();
  const ingestMethod = CONVERSATION_INGEST_METHODS.includes(methodValue as ConversationIngestMethod)
    ? methodValue as ConversationIngestMethod
    : 'OTHER';

  const externalConversationId = cleanOptional(input.externalConversationId, 240);
  const agentName = cleanOptional(input.agentName, 120);
  const occurredAtText = cleanOptional(input.occurredAt, 80);
  let occurredAt: Date | null = null;
  if (occurredAtText) {
    occurredAt = new Date(occurredAtText);
    if (Number.isNaN(occurredAt.getTime())) throw new Error('Enter a valid conversation date and time.');
  }
  return { provider, ingestMethod, externalConversationId, agentName, occurredAt };
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

// Provider-native IDs take precedence for idempotency. Content identity remains the fallback
// for pasted conversations that do not expose a provider conversation ID.
export function conversationExternalRef(metadata: ConversationMetadata, contentFingerprint: string) {
  if (metadata.externalConversationId) {
    return `conversation:${metadata.provider.toLowerCase()}:${digest(metadata.externalConversationId)}`;
  }
  return `conversation:content:${contentFingerprint}`;
}

export function sourceTypeForConversationIngest(method: ConversationIngestMethod): 'IMPORT' | 'API' {
  return method === 'ELEVENLABS_WEBHOOK' || method === 'ELEVENLABS_API' ? 'API' : 'IMPORT';
}

export function buildConversationPayload(input: {
  text: string;
  speakers: string[];
  turns: StoredConversationTurn[];
  metadata: ConversationMetadata;
}) {
  return {
    version: 2 as const,
    kind: 'CONVERSATION_TRANSCRIPT' as const,
    text: input.text,
    speakers: input.speakers,
    turns: input.turns,
    provider: input.metadata.provider,
    ingestMethod: input.metadata.ingestMethod,
    externalConversationId: input.metadata.externalConversationId,
    agentName: input.metadata.agentName,
    importedBy: 'OPERATOR' as const
  };
}
