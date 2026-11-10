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

export function speechFromDorianCall(data: ElevenLabsConversationData, conversationId: string, agentId: string) {
  // A result must match the server-issued identifiers before any text reaches the UI.
  if (data.conversation_id !== conversationId || data.agent_id !== agentId)
    throw new Error('Dorian conversation binding mismatch.');
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
