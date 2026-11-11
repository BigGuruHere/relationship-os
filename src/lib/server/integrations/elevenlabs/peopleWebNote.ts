import type { CapturedConversation } from '../../foundation/conversations';
import { resolveOrigin } from '$lib/env';
import { parseElevenLabsTranscript, type ElevenLabsConversationData } from './conversation';

export function peopleDorianAgent(locals: App.Locals, url: URL) {
  // Keep this slice on the owner-only DEV agent until live acceptance.
  if (locals.env === 'dev' && locals.user?.role === 'owner' && locals.sessionId &&
      url.origin === resolveOrigin('dev')) {
    return process.env.RELISH_DORIAN_WEB_TEST_AGENT_ID?.trim() || null;
  }
  return null;
}

export const personNoteIntention = 'Help the caller remember what matters about this person and any next step they mention. Keep the conversation brief and ask one natural question at a time.';

export function personNoteInitiation(callerName: string, personName: string) {
  // Names are display labels. The server-side launch keeps the authorization binding.
  const greeting = callerName ? 'Hi ' + callerName + '. ' : 'Hi. ';
  return {
    // ElevenLabs sends this as an agent override. The other fields personalise the prompt.
    firstMessage: greeting + 'What would you like to remember about ' + personName + '?',
    dynamicVariables: {
      caller_name: callerName || 'there',
      person_name: personName,
      call_intention: personNoteIntention
    }
  };
}

function requireDorianBinding(data: ElevenLabsConversationData, conversationId: string, agentId: string) {
  if (data.conversation_id !== conversationId || data.agent_id !== agentId)
    throw new Error('Dorian conversation binding mismatch.');
}
export function speechFromDorianCall(data: ElevenLabsConversationData, conversationId: string, agentId: string) {
  // A result must match the server-issued identifiers before any text reaches the UI.
  requireDorianBinding(data, conversationId, agentId);
  if (data.status === 'failed') return { state: 'failed' } as const;
  if (data.status !== 'done') return { state: 'pending' } as const;
  try {
    const transcript = parseElevenLabsTranscript(data);
    // Use participant speech only. Provider recaps describe the call rather than the person.
    const text = transcript.turns
      .filter(turn => turn.speaker === 'User')
      .map(turn => turn.text.slice('User: '.length)).join('\n').slice(0, 64000).trim();
    return text ? { state: 'ready', text } as const : { state: 'failed' } as const;
  } catch {
    return { state: 'failed' } as const;
  }
}


// Preserve all speech text and provider order for evidence. The bounded caller-only
// view above is used just to write the editable note summary.
export function capturedPeopleConversation(data: ElevenLabsConversationData, conversationId: string, agentId: string): CapturedConversation {
  requireDorianBinding(data, conversationId, agentId);
  if (data.status !== 'done' || !Array.isArray(data.transcript))
    throw new Error('Dorian conversation is not ready to save.');
  const turns = data.transcript.flatMap((item, index) => {
    const row = item as { message?: unknown; role?: unknown } | null;
    if (typeof row?.message !== 'string' || !row.message.trim()) return [];
    const role = row.role === 'user' ? 'OWNER' : row.role === 'agent' ? 'AGENT' : 'UNRESOLVED';
    return [{ id: 'T' + String(index + 1), role, text: row.message }] as const;
  });
  const start = Number((data.metadata as { start_time_unix_secs?: unknown } | null)?.start_time_unix_secs);
  const occurredAt = new Date(start * 1000);
  return {
    format: 'conversation-v1', binding: { provider: 'ELEVENLABS', conversationId, agentId },
    occurredAt: start > 0 && Number.isFinite(occurredAt.getTime()) ? occurredAt.toISOString() : null,
    completeness: turns.some(t => t.role === 'OWNER') && turns.some(t => t.role === 'AGENT') ? 'COMPLETE' : 'INCOMPLETE',
    turns
  };
}
