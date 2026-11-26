export const foundationScenarioKeys = [
  'first', 'returning', 'webFirst', 'webReturning', 'phoneFirst', 'phoneReturning', 'phoneConsent'
] as const;

export const foundationCopyLimits = { greeting: 1000, context: 1500, instruction: 3500 };
type Scenario = typeof foundationScenarioKeys[number];
type CopyField = keyof typeof foundationCopyLimits;
export type FoundationScenarioCopy = Partial<Record<CopyField, string>>;
export type FoundationScenarios = Partial<Record<Scenario, FoundationScenarioCopy>>;

// Only these presentation fields can cross the configuration boundary. The
// existing authenticated snapshot checks version, environment and provider ID.
export function validateFoundationScenarios(value: unknown): FoundationScenarios {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Foundation scenario configuration.');
  const result: FoundationScenarios = {};
  for (const [scenario, copy] of Object.entries(value)) {
    if (!foundationScenarioKeys.includes(scenario as Scenario) || !copy || typeof copy !== 'object' || Array.isArray(copy))
      throw new Error('Invalid Foundation scenario.');
    const fields: FoundationScenarioCopy = {};
    for (const [field, text] of Object.entries(copy)) {
      const key = field as CopyField;
      if (!Object.hasOwn(foundationCopyLimits, key) || typeof text !== 'string' || text.length > foundationCopyLimits[key])
        throw new Error('Invalid Foundation scenario wording.');
      if (text.trim()) fields[key] = text.trim();
    }
    if (Object.keys(fields).length) result[scenario as Scenario] = fields;
  }
  return result;
}

export function foundationScenarioCopy(config: FoundationScenarios | undefined, telephone: boolean, returning: boolean) {
  const shared = config?.[returning ? 'returning' : 'first'];
  const channel = telephone
    ? config?.[returning ? 'phoneReturning' : 'phoneFirst']
    : config?.[returning ? 'webReturning' : 'webFirst'];
  return { ...shared, ...channel };
}

// The configured browser agent is the shared template for the same deployment.
// A separate phone provider can override these fields without copying the draft.
export function inheritFoundationScenarios(shared: FoundationScenarios, agent: FoundationScenarios) {
  const scenarios: FoundationScenarios = {};
  for (const key of foundationScenarioKeys) {
    if (shared[key] || agent[key]) scenarios[key] = { ...shared[key], ...agent[key] };
  }
  return scenarios;
}

export function phoneConsentCopy(copy?: FoundationScenarioCopy) {
  // Editable wording cannot remove the server's consent rules or imply
  // delivery. This branch receives no personalisation or private context.
  const instruction = copy?.instruction
    ? 'Ask for explicit agreement to the current terms and privacy policy before substantive conversation. Use the SMS status to describe delivery accurately. Wait for the acceptance tool to return ACCEPTED before continuing. ' + copy.instruction
    : undefined;
  return {
    ...(copy?.greeting ? { greeting: copy.greeting } : {}),
    variables: {
      ...(copy?.context ? { call_context: copy.context } : {}),
      ...(instruction ? { call_instruction: instruction, call_intention: instruction } : {})
    }
  };
}
