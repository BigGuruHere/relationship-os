// Stage 8.22.4: provider-facing response contract for Dorian's shared agent.
// Never log or include actual session tokens in contract diagnostics.
const contractDefaults = Object.freeze({
  memory_and_identity_context: '', call_instruction: '', call_type: 'INBOUND_PHONE',
  user_name: '', previous_calls: '0', last_call_summary: '', emotion_label: '',
  agent_website: '', agent_type: 'DORIAN', relish_terms_status: 'REQUIRED',
  relish_terms_sms_status: 'NOT_AVAILABLE'
});
const sentinels = new Set(['PROCESSING_NO_SESSION', 'UNRESOLVED_NO_SESSION']);

/**
 * Validate and fill the provider's required scalar dynamic variables.
 * Keeping the incoming envelope unknown forces all public payload data through
 * the runtime checks below before the response is sent to ElevenLabs.
 * @param {unknown} payload
 * @param {'PARTICIPANT' | 'BROWSER' | 'PROCESSING_ONLY' | 'UNRESOLVED'} mode
 */
export function finishDorianInitiationData(payload, mode) {
  if (!payload || typeof payload !== 'object' ||
      !('type' in payload) || payload.type !== 'conversation_initiation_client_data' ||
      !('dynamic_variables' in payload) || !payload.dynamic_variables ||
      typeof payload.dynamic_variables !== 'object' ||
      Array.isArray(payload.dynamic_variables)) {
    throw new Error('Invalid Dorian initiation response envelope.');
  }
  // A generic object has been structurally validated; individual values are
  // still untrusted and must pass the scalar/credential checks below.
  /** @type {Record<string, unknown>} */
  const vars = { ...contractDefaults, .../** @type {Record<string, unknown>} */ (payload.dynamic_variables) };
  for (const [key, value] of Object.entries(vars)) {
    if (value === null || value === undefined || !['string', 'number', 'boolean'].includes(typeof value)) {
      throw new Error(`Invalid Dorian initiation variable type: ${key}`);
    }
  }
  const token = vars.relish_network_session;
  const isCredential = typeof token === 'string' && /^[A-Za-z0-9_-]{40,100}$/.test(token);
  if (mode === 'PARTICIPANT' || mode === 'BROWSER') {
    if (!isCredential || (typeof token === 'string' && sentinels.has(token))) throw new Error('Missing authorised Dorian session credential.');
  } else if (mode === 'PROCESSING_ONLY' || mode === 'UNRESOLVED') {
    if (token !== (mode === 'PROCESSING_ONLY' ? 'PROCESSING_NO_SESSION' : 'UNRESOLVED_NO_SESSION')) {
      throw new Error('Unsafe nonparticipant Dorian session credential.');
    }
  } else throw new Error('Invalid Dorian initiation mode.');
  return { ...payload, dynamic_variables: vars };
}

/**
 * Return only nonsecret response-contract diagnostics for operational logging.
 * @param {unknown} payload
 */
export function initiationContractDiagnostics(payload) {
  const vars = payload && typeof payload === 'object' &&
    'dynamic_variables' in payload && payload.dynamic_variables &&
    typeof payload.dynamic_variables === 'object' &&
    !Array.isArray(payload.dynamic_variables)
    ? /** @type {Record<string, unknown>} */ (payload.dynamic_variables)
    : null;
  return {
    hasSessionVariable: typeof vars?.relish_network_session === 'string',
    hasCallInstruction: typeof vars?.call_instruction === 'string',
    allVariablesScalar: Boolean(vars && Object.values(vars).every(value =>
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
  };
}
