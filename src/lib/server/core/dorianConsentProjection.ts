// Stage 8.20.2: one procedure across direct phone, shared browser and SMS calls.
// Pure call projection — never changes authorised participant memory or session data.
// Relish determines the policy status server-side; Dorian cannot change it by prompt.
export type DorianCallPolicyProjection = { instruction: string; accepted: boolean; smsStatus?: string };

export function withConsentGate(
  dynamicVariables: Record<string, unknown>,
  policy: DorianCallPolicyProjection
): Record<string, unknown> {
  // All existing context (including name, Living Understanding, last call summary,
  // ContextSpace guidance, and the signed conversation session) is preserved.
  const vars = { ...dynamicVariables };
  vars.relish_terms_status = policy.accepted ? 'ACCEPTED' : 'REQUIRED';
  // Reflect submission status, never a claim that the handset received the message.
  vars.relish_terms_sms_status = policy.smsStatus ?? (policy.accepted ? 'NOT_REQUIRED' : 'NOT_AVAILABLE');
  // Mandatory consent procedure MUST precede editable persona/scenario instructions.
  // The ElevenLabs Dorian system prompt must incorporate {{call_instruction}}.
  vars.call_instruction = [
    policy.instruction.trim(),
    String(dynamicVariables.call_instruction ?? '').trim()
  ].filter(Boolean).join('\n\n');
  return vars;
}
