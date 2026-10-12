// PURPOSE: Administer stable Relish agents and replaceable external provider deployments without code or .env changes.
// SECURITY: Every mutation is owner-scoped. Provider ids and phone numbers are encrypted at rest with exact-match HMAC indexes.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { buildScopedIndexToken, decrypt, encrypt } from '$lib/crypto';
import { normalizePhoneForIdentity } from '$lib/server/integrations/elevenlabs/phone';
import { decryptContextSpaceDisplayName } from '$lib/server/core/contextSpaceDirectory';

const PROVIDER = 'ELEVENLABS';
const ENVIRONMENTS = new Set(['DEVELOPMENT', 'TEST', 'PRODUCTION']);
const PROVIDER_AGENT_AAD = 'agentProviderBinding.providerAgentId';
const PHONE_AAD = 'agentProviderBinding.inboundPhone';

function clean(value: FormDataEntryValue | null, max = 240) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : '';
}
function cleanEnvironment(value: FormDataEntryValue | null) {
  const environment = clean(value, 32).toUpperCase() || 'PRODUCTION';
  if (!ENVIRONMENTS.has(environment)) throw new Error('Choose Development, Test or Production.');
  return environment;
}
function agentKey(value: string) {
  const key = value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  if (!key) throw new Error('Enter an agent key such as DORIAN.');
  return key;
}
async function ownedSpace(userId: string, contextSpaceId: string) {
  const space = await prisma.contextSpace.findFirst({ where: { id: contextSpaceId, ownerUserId: userId }, select: { id: true, domainKey: true } });
  if (!space) throw new Error('Choose one of your application spaces.');
  return space;
}
async function ownedAgent(userId: string, id: string) {
  const agent = await prisma.agentDefinition.findFirst({ where: { id, userId }, select: { id: true, allowedDomainKeys: true, allowedContextSpaceIds: true } });
  if (!agent) throw new Error('Choose one of your Relish agents.');
  return agent;
}
async function assertNoActiveBindingConflict(params: { userId: string; providerAgentId: string; phone: string | null; excludeId?: string }) {
  const ors: any[] = [];
  if (params.providerAgentId) ors.push({ providerAgentIdIdx: buildScopedIndexToken(params.providerAgentId, 'agent-provider:elevenlabs:agent-id') });
  if (params.phone) ors.push({ inboundPhoneIdx: buildScopedIndexToken(params.phone, 'agent-provider:elevenlabs:called-number') });
  if (!ors.length) throw new Error('Enter an ElevenLabs agent ID, an inbound phone number, or both.');
  const conflict = await prisma.agentProviderBinding.findFirst({
    where: { provider: PROVIDER, isActive: true, ...(params.excludeId ? { id: { not: params.excludeId } } : {}), OR: ors },
    select: { id: true, userId: true }
  });
  if (conflict) throw new Error('That active ElevenLabs agent ID or phone number is already bound. Replace/deactivate the existing binding first.');
}
function bindingData(input: { userId: string; agentDefinitionId: string; contextSpaceId: string; environment: string; providerAgentId: string; phone: string | null; validFrom?: Date }) {
  return {
    userId: input.userId,
    agentDefinitionId: input.agentDefinitionId,
    contextSpaceId: input.contextSpaceId,
    provider: PROVIDER,
    environment: input.environment,
    providerAgentIdEnc: input.providerAgentId ? encrypt(input.providerAgentId, PROVIDER_AGENT_AAD) : null,
    providerAgentIdIdx: input.providerAgentId ? buildScopedIndexToken(input.providerAgentId, 'agent-provider:elevenlabs:agent-id') : null,
    inboundPhoneEnc: input.phone ? encrypt(input.phone, PHONE_AAD) : null,
    inboundPhoneIdx: input.phone ? buildScopedIndexToken(input.phone, 'agent-provider:elevenlabs:called-number') : null,
    isActive: true,
    validFrom: input.validFrom ?? new Date(),
    validTo: null
  };
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  const [agents, spaces, bindings] = await Promise.all([
    prisma.agentDefinition.findMany({ where: { userId }, select: { id: true, key: true, name: true, status: true, personaKey: true, purposeKey: true, allowedDomainKeys: true, allowedContextSpaceIds: true }, orderBy: { name: 'asc' } }),
    prisma.contextSpace.findMany({ where: { ownerUserId: userId }, select: { id: true, domainKey: true, displayNameEnc: true }, orderBy: [{ domainKey: 'asc' }, { createdAt: 'asc' }] }),
    prisma.agentProviderBinding.findMany({
      where: { userId },
      select: { id: true, provider: true, environment: true, providerAgentIdEnc: true, inboundPhoneEnc: true, isActive: true, validFrom: true, validTo: true, createdAt: true, contextSpaceId: true, agentDefinition: { select: { id: true, key: true, name: true } }, contextSpace: { select: { domainKey: true, displayNameEnc: true } } },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    })
  ]);
  return {
    environments: [...ENVIRONMENTS],
    agents,
    spaces: spaces.map(space => ({ id: space.id, domainKey: space.domainKey, displayName: decryptContextSpaceDisplayName(space.displayNameEnc, space.domainKey) })),
    bindings: bindings.map(binding => ({
      id: binding.id, provider: binding.provider, environment: binding.environment, isActive: binding.isActive,
      providerAgentId: binding.providerAgentIdEnc ? decrypt(binding.providerAgentIdEnc, PROVIDER_AGENT_AAD) : '',
      inboundPhone: binding.inboundPhoneEnc ? decrypt(binding.inboundPhoneEnc, PHONE_AAD) : '',
      validFrom: binding.validFrom, validTo: binding.validTo,
      agent: binding.agentDefinition,
      contextSpaceId: binding.contextSpaceId,
      contextSpace: { domainKey: binding.contextSpace.domainKey, displayName: decryptContextSpaceDisplayName(binding.contextSpace.displayNameEnc, binding.contextSpace.domainKey) }
    }))
  };
};

export const actions: Actions = {
  createAgent: async ({ locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    try {
      const name = clean(form.get('name'), 120);
      if (!name) throw new Error('Enter an agent name.');
      const key = agentKey(clean(form.get('key'), 80) || name);
      const contextSpaceId = clean(form.get('contextSpaceId'), 80);
      const space = await ownedSpace(locals.user.id, contextSpaceId);
      await prisma.agentDefinition.create({ data: {
        userId: locals.user.id,
        key,
        name,
        description: clean(form.get('description'), 400) || `External conversation agent ${name}`,
        category: 'conversation',
        status: 'active',
        personaKey: key.toLowerCase(),
        purposeKey: 'conversation',
        deploymentScope: 'external_voice',
        authorityLevel: 'advisory',
        allowedDomainKeys: [space.domainKey],
        allowedContextSpaceIds: [space.id],
        defaultModelProvider: 'openai',
        defaultModelName: 'provider-managed',
        systemPrompt: `You are ${name}, a Relish conversation agent. Use only the bounded context and permissions supplied for the current conversation.`
      }});
      return { success: `Created logical agent ${name}.` };
    } catch (error: any) { return fail(400, { error: error?.message || 'Agent could not be created.' }); }
  },

  createBinding: async ({ locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    try {
      const agentDefinitionId = clean(form.get('agentDefinitionId'), 80);
      const contextSpaceId = clean(form.get('contextSpaceId'), 80);
      const environment = cleanEnvironment(form.get('environment'));
      const providerAgentId = clean(form.get('providerAgentId'), 240);
      const phone = normalizePhoneForIdentity(form.get('inboundPhone'));
      const [agent, space] = await Promise.all([ownedAgent(locals.user.id, agentDefinitionId), ownedSpace(locals.user.id, contextSpaceId)]);
      await assertNoActiveBindingConflict({ userId: locals.user.id, providerAgentId, phone });
      const allowedContextSpaceIds = [...new Set([...agent.allowedContextSpaceIds, space.id])];
      const allowedDomainKeys = [...new Set([...agent.allowedDomainKeys, space.domainKey])];
      await prisma.$transaction([
        prisma.agentDefinition.update({ where: { id: agent.id }, data: { allowedContextSpaceIds, allowedDomainKeys } }),
        prisma.agentProviderBinding.create({ data: bindingData({ userId: locals.user.id, agentDefinitionId, contextSpaceId, environment, providerAgentId, phone }) })
      ]);
      return { success: 'Agent deployment binding created.' };
    } catch (error: any) { return fail(400, { error: error?.message || 'Binding could not be created.' }); }
  },

  replaceBinding: async ({ locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    try {
      const bindingId = clean(form.get('bindingId'), 80);
      const current = await prisma.agentProviderBinding.findFirst({ where: { id: bindingId, userId: locals.user.id }, select: { id: true, agentDefinitionId: true, contextSpaceId: true, environment: true, isActive: true } });
      if (!current || !current.isActive) throw new Error('Choose an active binding to replace.');
      const environment = cleanEnvironment(form.get('environment') || current.environment);
      const providerAgentId = clean(form.get('providerAgentId'), 240);
      const phone = normalizePhoneForIdentity(form.get('inboundPhone'));
      await assertNoActiveBindingConflict({ userId: locals.user.id, providerAgentId, phone, excludeId: current.id });
      const now = new Date();
      await prisma.$transaction([
        prisma.agentProviderBinding.update({ where: { id: current.id }, data: { isActive: false, validTo: now } }),
        prisma.agentProviderBinding.create({ data: bindingData({ userId: locals.user.id, agentDefinitionId: current.agentDefinitionId, contextSpaceId: current.contextSpaceId, environment, providerAgentId, phone, validFrom: now }) })
      ]);
      return { success: 'Binding replaced. The old provider assignment remains in history.' };
    } catch (error: any) { return fail(400, { error: error?.message || 'Binding could not be replaced.' }); }
  },

  deactivateBinding: async ({ locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const bindingId = clean(form.get('bindingId'), 80);
    const binding = await prisma.agentProviderBinding.findFirst({ where: { id: bindingId, userId: locals.user.id, isActive: true }, select: { id: true } });
    if (!binding) return fail(404, { error: 'Active binding not found.' });
    await prisma.agentProviderBinding.update({ where: { id: binding.id }, data: { isActive: false, validTo: new Date() } });
    return { success: 'Binding deactivated.' };
  }
};
