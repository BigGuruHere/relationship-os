// PURPOSE: Resolve replaceable ElevenLabs provider identifiers to a stable Relish AgentDefinition deployment.
// SECURITY: Provider ids and phone numbers are exact-match HMAC indexes. Conflicting bindings fail closed.
import { prisma } from '$lib/db';
import { buildScopedIndexToken } from '$lib/crypto';
import { normalizePhoneForIdentity } from './phone.ts';

export type ElevenLabsDeploymentResolution = {
  status: 'RESOLVED' | 'UNRESOLVED' | 'CONFLICT';
  bindingId: string | null;
  userId: string | null;
  contextSpaceId: string | null;
  domainKey: string | null;
  agentDefinitionId: string | null;
  agentKey: string | null;
  agentName: string | null;
  environment: string | null;
  method: 'AGENT_ID_AND_NUMBER' | 'AGENT_ID' | 'CALLED_NUMBER' | 'SAME_AGENT_BINDING_DRIFT' | null;
  warning: string | null;
};

function clean(value: unknown, max = 240) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : '';
}

function activeAtFilter(at: Date | null) {
  if (!at) return { isActive: true } as const;
  return {
    validFrom: { lte: at },
    OR: [{ validTo: null }, { validTo: { gt: at } }]
  } as const;
}

export async function resolveElevenLabsAgentDeployment(input: {
  agentId?: unknown;
  calledNumber?: unknown;
  at?: Date | null;
}): Promise<ElevenLabsDeploymentResolution> {
  const agentId = clean(input.agentId);
  const calledNumber = normalizePhoneForIdentity(input.calledNumber);
  if (!agentId && !calledNumber) {
    return { status: 'UNRESOLVED', bindingId: null, userId: null, contextSpaceId: null, domainKey: null, agentDefinitionId: null, agentKey: null, agentName: null, environment: null, method: null, warning: 'NO_DEPLOYMENT_IDENTIFIER' };
  }

  const at = input.at instanceof Date && !Number.isNaN(input.at.getTime()) ? input.at : null;
  const validity: any = activeAtFilter(at);
  const baseSelect = {
    id: true, userId: true, contextSpaceId: true, agentDefinitionId: true, environment: true,
    contextSpace: { select: { domainKey: true } },
    agentDefinition: { select: { key: true, name: true } }
  } as const;

  const [agentRows, phoneRows] = await Promise.all([
    agentId ? prisma.agentProviderBinding.findMany({
      where: { provider: 'ELEVENLABS', providerAgentIdIdx: buildScopedIndexToken(agentId, 'agent-provider:elevenlabs:agent-id'), ...validity },
      select: baseSelect, take: 5
    }) : Promise.resolve([]),
    calledNumber ? prisma.agentProviderBinding.findMany({
      where: { provider: 'ELEVENLABS', inboundPhoneIdx: buildScopedIndexToken(calledNumber, 'agent-provider:elevenlabs:called-number'), ...validity },
      select: baseSelect, take: 5
    }) : Promise.resolve([])
  ]);

  const unique = (rows: any[]) => [...new Map(rows.map(row => [row.id, row])).values()];
  const agents = unique(agentRows as any[]);
  const phones = unique(phoneRows as any[]);
  const all = unique([...agents, ...phones]);

  if (!all.length) {
    return { status: 'UNRESOLVED', bindingId: null, userId: null, contextSpaceId: null, domainKey: null, agentDefinitionId: null, agentKey: null, agentName: null, environment: null, method: null, warning: agentId && calledNumber ? 'UNBOUND_AGENT_AND_NUMBER' : agentId ? 'UNBOUND_AGENT_ID' : 'UNBOUND_CALLED_NUMBER' };
  }

  const sameDeployment = (a: any, b: any) => a.userId === b.userId && a.contextSpaceId === b.contextSpaceId && a.agentDefinitionId === b.agentDefinitionId;
  const choose = (row: any, method: ElevenLabsDeploymentResolution['method'], warning: string | null = null): ElevenLabsDeploymentResolution => ({
    status: 'RESOLVED', bindingId: row.id, userId: row.userId, contextSpaceId: row.contextSpaceId,
    domainKey: row.contextSpace.domainKey, agentDefinitionId: row.agentDefinitionId, agentKey: row.agentDefinition.key, agentName: row.agentDefinition.name,
    environment: row.environment, method, warning
  });

  if (agentId && calledNumber) {
    const intersection = agents.find(a => phones.some(p => p.id === a.id));
    if (intersection) return choose(intersection, 'AGENT_ID_AND_NUMBER');

    if (agents.length === 1 && phones.length === 1 && sameDeployment(agents[0], phones[0])) {
      return choose(agents[0], 'SAME_AGENT_BINDING_DRIFT', 'AGENT_ID_AND_NUMBER_USE_DIFFERENT_BINDING_ROWS');
    }
    if (agents.length === 0 && phones.length === 1) {
      return choose(phones[0], 'CALLED_NUMBER', 'PROVIDER_AGENT_ID_NOT_BOUND');
    }
    if (phones.length === 0 && agents.length === 1) {
      return choose(agents[0], 'AGENT_ID', 'CALLED_NUMBER_NOT_BOUND');
    }
    return { status: 'CONFLICT', bindingId: null, userId: null, contextSpaceId: null, domainKey: null, agentDefinitionId: null, agentKey: null, agentName: null, environment: null, method: null, warning: 'AGENT_ID_AND_NUMBER_CONFLICT' };
  }

  const rows = agentId ? agents : phones;
  if (rows.length !== 1) {
    return { status: 'CONFLICT', bindingId: null, userId: null, contextSpaceId: null, domainKey: null, agentDefinitionId: null, agentKey: null, agentName: null, environment: null, method: null, warning: 'AMBIGUOUS_DEPLOYMENT_IDENTIFIER' };
  }
  return choose(rows[0], agentId ? 'AGENT_ID' : 'CALLED_NUMBER');
}
