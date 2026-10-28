// Stage 8.20: centrally published *conversational* configuration for Dorian.
// This file deliberately does NOT make identity, ContextSpace, data access, consent
// or proxy-routing decisions. It only projects already authorised information into
// a prompt. Changes to safety/security gates remain code-controlled in Relish.
import { requiredEnv } from '$lib/server/config/requiredEnv';
import { prisma } from '$lib/db';

type Scenario = 'new' | 'returningUnnamed' | 'returningNamed';
type Domain = 'business' | 'general' | 'dating';
type ControlConfig = {
  agentId: string;
  personaInstruction: string;
  openingNew: string; instructionNew: string;
  openingReturningUnnamed: string; instructionReturningUnnamed: string;
  openingReturningNamed: string; instructionReturningNamed: string;
  contextBusiness: string; contextGeneral: string; contextDating: string;
};
export type DorianCallProjection = {
  dynamicVariables: Record<string, unknown>;
  firstMessage: string | null;
  revision: number | null;
  scenario: Scenario;
};

function runtimeEnvironment(): 'local' | 'dev' | 'prod' {
  const value = requiredEnv('RELISH_CONTROL_PLANE_ENV');
  if (value !== 'local' && value !== 'dev' && value !== 'prod') {
    throw new Error('[Relish control plane] RELISH_CONTROL_PLANE_ENV must be local, dev or prod.');
  }
  return value;
}
function mandatoryConfig(value: unknown): ControlConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('[Relish control plane] Invalid published configuration.');
  const config = value as Record<string,unknown>;
  const limits: Record<string,number> = {
    agentId: 200, personaInstruction: 5000, openingNew: 1000,
    instructionNew: 3500, openingReturningUnnamed: 1000,
    instructionReturningUnnamed: 3500, openingReturningNamed: 1000,
    instructionReturningNamed: 3500, contextBusiness: 5000,
    contextGeneral: 5000, contextDating: 5000
  };
  for (const [key,max] of Object.entries(limits)) {
    if (typeof config[key] !== 'string' || (key !== 'agentId' && !(config[key] as string).trim()) || (config[key] as string).length > max) {
      throw new Error(`[Relish control plane] Invalid published field: ${key}`);
    }
  }
  return config as ControlConfig;
}
function scenarioFor(previousCalls: number, preferredName: string): Scenario {
  // 'Telephone caller' is the provisional placeholder, not a person's chosen name.
  const named = preferredName.trim().toLowerCase() !== 'telephone caller' && Boolean(preferredName.trim());
  return previousCalls < 1 ? 'new' : named ? 'returningNamed' : 'returningUnnamed';
}
function sameConfigContent(a: ControlConfig, b: ControlConfig): boolean {
  const normalised = (value: ControlConfig) => JSON.stringify(Object.entries(value).sort(([left],[right]) => left.localeCompare(right)));
  return normalised(a) === normalised(b);
}
function safeName(value: string) { return value.replace(/[\r\n\x00-\x1f]/g,'').trim().slice(0,80); }
const safeContext = (domainKey: string): Domain => {
  if (!['business','general','dating'].includes(domainKey)) {
    // Do not substitute Network for an unknown security scope.
    throw new Error('[Relish control plane] Unknown ContextSpace domain.');
  }
  return domainKey as Domain;
};

// Avoid placing private participant data in GET requests. Fetch only a public
// operator-authored template. The token is a server-side per-environment read key.
// Snapshot-based delivery keeps Agent Management outages from becoming live call
// outages. This is NOT a silent default: it uses only a published configuration
// successfully authenticated, validated and saved on an earlier request.
// A fresh installation with no snapshot fails explicitly until first sync.
export async function fetchPublishedDorianConfig(): Promise<{revision:number; config:ControlConfig} | null> {
  if (process.env.RELISH_CONTROL_PLANE_ENABLED === 'NO') return null;
  if (process.env.RELISH_CONTROL_PLANE_ENABLED !== 'YES') {
    throw new Error('[Relish control plane] RELISH_CONTROL_PLANE_ENABLED must be YES or NO.');
  }
  const environment = runtimeEnvironment();
  const refreshSecondsText = requiredEnv('RELISH_CONTROL_PLANE_REFRESH_SECONDS');
  const refreshSeconds = Number(refreshSecondsText);
  if (!Number.isSafeInteger(refreshSeconds) || refreshSeconds < 1 || refreshSeconds > 3600) {
    throw new Error('[Relish control plane] RELISH_CONTROL_PLANE_REFRESH_SECONDS must be between 1 and 3600.');
  }
  const origin = new URL(requiredEnv('RELISH_CONTROL_PLANE_URL'));
  if (origin.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(origin.hostname)) {
    throw new Error('[Relish control plane] RELISH_CONTROL_PLANE_URL must be HTTPS.');
  }
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('[Relish control plane] RELISH_CONTROL_PLANE_URL must be a bare origin.');
  }
  const token = requiredEnv('RELISH_CONTROL_PLANE_READ_TOKEN',32);
  // Never ask a caller or an LLM to choose the environment. This selector is
  // solely a server-side deployment variable.
  const snapshot = await prisma.dorianAgentConfigSnapshot.findUnique({
    where: { environment_agentKey: { environment, agentKey: 'DORIAN' } }
  });
  const validatedSnapshot = snapshot ? {
    revision: snapshot.revision,
    config: mandatoryConfig(snapshot.content)
  } : null;
  if (validatedSnapshot && snapshot &&
      Date.now() - snapshot.fetchedAt.getTime() < refreshSeconds * 1000) {
    return validatedSnapshot;
  }
  const url = new URL('/api/v1/agents/DORIAN/config', origin);
  url.searchParams.set('env', environment);
  let response: Response;
  try {
    response = await fetch(url, {
      method:'GET', headers:{ Authorization:`Bearer ${token}` },
      cache:'no-store', signal:AbortSignal.timeout(validatedSnapshot ? 1800 : 10000)
    });
  } catch {
    if (validatedSnapshot) {
      console.warn(`[Relish control plane] Management unavailable; using verified ${environment} revision ${validatedSnapshot.revision}.`);
      return validatedSnapshot;
    }
    throw new Error('[Relish control plane] No verified published configuration; management is unavailable.');
  }
  // Auth failures must NOT be disguised as an ordinary service outage.
  if (response.status === 401 || response.status === 403) {
    throw new Error(`[Relish control plane] Configuration authentication failed (HTTP ${response.status}).`);
  }
  // A temporary 5xx failure can use the last verified revision; a 4xx or
  // malformed response is a configuration error and must fail explicitly.
  if (response.status >= 500 && validatedSnapshot) {
    console.warn(`[Relish control plane] Management error HTTP ${response.status}; using verified ${environment} revision ${validatedSnapshot.revision}.`);
    return validatedSnapshot;
  }
  if (!response.ok) throw new Error(`[Relish control plane] Configuration fetch failed (HTTP ${response.status}).`);
  let payload: any;
  try { payload = await response.json(); }
  catch { throw new Error('[Relish control plane] Invalid published JSON response.'); }
  if (payload?.environment !== environment || payload?.agentKey !== 'DORIAN' ||
      !Number.isSafeInteger(payload.revision) || payload.revision < 1) {
    throw new Error('[Relish control plane] Invalid environment, agent or revision.');
  }
  if (validatedSnapshot && payload.revision < validatedSnapshot.revision) {
    throw new Error('[Relish control plane] Published revision went backwards unexpectedly.');
  }
  const config = mandatoryConfig(payload.config);
  // Reject same-revision mutation: published content is immutable. Restoring
  // a previous version always creates a *new* numbered revision centrally.
  if (validatedSnapshot && payload.revision === validatedSnapshot.revision &&
      !sameConfigContent(config, validatedSnapshot.config)) {
    throw new Error('[Relish control plane] Content changed without a new published revision.');
  }
  // Prisma's JSON input expects a JSON-compatible object, not a TypeScript
  // domain interface; validate first and materialise a plain JSON value.
  const storedContent = JSON.parse(JSON.stringify(config));
  await prisma.dorianAgentConfigSnapshot.upsert({
    where: { environment_agentKey: { environment, agentKey:'DORIAN' } },
    create: { environment, agentKey:'DORIAN', revision:payload.revision, content:storedContent, fetchedAt:new Date() },
    update: { revision:payload.revision, content:storedContent, fetchedAt:new Date() }
  });
  return { revision:payload.revision, config };
}

// When enabled, missing or invalid configuration fails explicitly. The last
// authenticated published snapshot is permitted during management outages.
// Calls with a processing-only or unresolved identity never reach this function.
export async function configureDorianCall(input: {
  dynamicVariables: Record<string, unknown>;
  domainKey: string;
  previousCalls: number;
  preferredName: string;
  providerAgentId: string;
  published?: {revision:number; config:ControlConfig} | null;
}): Promise<DorianCallProjection> {
  const scenario = scenarioFor(input.previousCalls, input.preferredName);
  if (process.env.RELISH_CONTROL_PLANE_ENABLED === 'NO') {
    return {dynamicVariables:input.dynamicVariables,firstMessage:null,revision:null,scenario};
  }
  if (process.env.RELISH_CONTROL_PLANE_ENABLED !== 'YES') {
    throw new Error('[Relish control plane] RELISH_CONTROL_PLANE_ENABLED must be YES or NO.');
  }
  const published = input.published === undefined ? await fetchPublishedDorianConfig() : input.published;
  if (!published) throw new Error('[Relish control plane] Published configuration required when enabled.');
  const {revision,config} = published;
  if (config.agentId && config.agentId !== input.providerAgentId) {
    // The control plane cannot silently override DB ownership or the proxy map.
    throw new Error('[Relish control plane] Published ElevenLabs agent ID does not match authorised deployment binding.');
  }
  const domain = safeContext(input.domainKey);
  const contextInstruction = domain === 'business' ? config.contextBusiness : domain === 'dating' ? config.contextDating : config.contextGeneral;
  const scenarioInstruction = scenario === 'new' ? config.instructionNew : scenario === 'returningNamed' ? config.instructionReturningNamed : config.instructionReturningUnnamed;
  const messageTemplate = scenario === 'new' ? config.openingNew : scenario === 'returningNamed' ? config.openingReturningNamed : config.openingReturningUnnamed;
  const name = safeName(input.preferredName);
  const firstMessage = messageTemplate.replaceAll('{{name}}',name || 'you');
  const oldInstructions = String(input.dynamicVariables.call_instruction || '');
  return {
    scenario,revision,firstMessage,
    dynamicVariables:{
      ...input.dynamicVariables,
      relish_call_scenario:scenario === 'new' ? 'NEW' : scenario === 'returningNamed' ? 'RETURNING_NAMED' : 'RETURNING_UNNAMED',
      relish_agent_config_revision:String(revision),
      relish_context_instruction:contextInstruction,
      relish_persona_instruction:config.personaInstruction,
      relish_scenario_instruction:scenarioInstruction,
      // Keep the existing {{call_instruction}} in ElevenLabs effective without
      // adding new mandatory agent prompt variables during rollout.
      call_instruction:[oldInstructions,config.personaInstruction,contextInstruction,scenarioInstruction].filter(Boolean).join('\n\n')
    }
  };
}

// Consent is a server-owned gate independent of the editable first messages.
export function safeFirstMessage(firstMessage:string | null, policy:{accepted:boolean}):string | null {
  return policy.accepted ? firstMessage : "Hi, I'm Dorian, an AI networking partner. Before we get started, I'd like to explain our Terms and Privacy Notice.";
}
