import { activeFoundationCallPrompt, foundationCallPrompts } from './foundationCallPrompts';

// Pure provider adapter: callers must resolve identity, consent and eligible memory first.
// Retain the established variable names so the dedicated agent can reuse its prompt.
export function foundationCallInitiation(input: {
  name: string;
  topics: { title: string; prose: string }[];
  returning: boolean;
  lastCallAt: string;
  lastCallSummary: string;
}) {
  const label = input.name.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  const prompt = foundationCallPrompts[activeFoundationCallPrompt];
  // Placeholder display names are omitted in both versions.
  const displayName = label === 'New Relish user' || label === 'Me' ? '' : label;
  const name = prompt.firstNameOnly ? displayName.split(' ')[0] : displayName;
  const memory = JSON.stringify(input.topics.slice(-12).map(topic => ({
    title: topic.title.slice(0, 200), prose: topic.prose.slice(0, 600)
  })));
  const instruction = [
    ...prompt.instructions,
    input.returning ? prompt.returningInstruction : prompt.firstCallInstruction
  ].join(' ');
  const greeting = name ? 'Hi ' + name + '. ' : 'Hi there. ';
  return {
    firstMessage: greeting + (input.returning ? prompt.returningOpening : prompt.opening),
    dynamicVariables: {
      caller_name: name, user_name: name, participant_name: name,
      call_type: 'FOUNDATION_SELF_WEB', relish_identity_status: 'SIGNED_IN_ACCOUNT',
      relish_terms_status: 'ACCEPTED', call_instruction: instruction, call_intention: instruction,
      call_context: prompt.context,
      continuity_status: input.returning ? 'RETURNING' : 'FIRST_SAVED_CALL',
      memory_and_identity_context: memory, living_understanding: memory,
      last_call_summary: input.lastCallSummary, last_call_at: input.lastCallAt
    }
  };
}
