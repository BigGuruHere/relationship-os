import { resolveOrigin } from '$lib/env';
import { parseElevenLabsTranscript, readElevenLabsSummary, type ElevenLabsConversationData } from './conversation';

export function peopleDorianAgent(locals: App.Locals, url: URL) {
  // Keep this slice on the owner-only DEV agent until live acceptance.
  if (locals.env === 'dev' && locals.user?.role === 'owner' && locals.sessionId &&
      url.origin === resolveOrigin('dev')) {
    return process.env.RELISH_DORIAN_WEB_TEST_AGENT_ID?.trim() || null;
  }
  return null;
}

export function draftFromDorianCall(data: ElevenLabsConversationData, conversationId: string, agentId: string) {
  // A result must match the server-issued identifiers before any text reaches the UI.
  if (data.conversation_id !== conversationId || data.agent_id !== agentId)
    throw new Error('Dorian conversation binding mismatch.');
  if (data.status === 'failed') return { state: 'failed' } as const;
  if (data.status !== 'done') return { state: 'pending' } as const;
  try {
    const transcript = parseElevenLabsTranscript(data);
    // Prefer the provider's summary. Fall back to the user's own words, excluding agent suggestions.
    const text = readElevenLabsSummary(data) || transcript.turns
      .filter(turn => turn.speaker === 'User')
      .map(turn => turn.text.slice('User: '.length)).join('\n').slice(0, 64000).trim();
    return text ? { state: 'ready', text } as const : { state: 'failed' } as const;
  } catch {
    return { state: 'failed' } as const;
  }
}
