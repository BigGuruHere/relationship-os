// src/lib/server/core/agentDataAccess.ts
// PURPOSE: Stage 8.5 purpose-scoped relationship-data permissions for agents.
// SECURITY: Tool/action permission is separate. This policy controls which Core data an agent may receive.

import { prisma } from '$lib/db';
import type { CoreAccessContext } from '$lib/server/core/accessPolicy';

export type AgentReadableEntityType = 'contact' | 'company' | 'deal' | 'project' | 'person';

export type AgentDataAccessPolicySnapshot = {
  id: string;
  scopeKey: string;
  allowContacts: boolean;
  allowCompanies: boolean;
  allowDeals: boolean;
  allowProjects: boolean;
  allowPeople: boolean;
  allowIdentity: boolean;
  allowContactMethods: boolean;
  allowInteractions: boolean;
  allowKnowledgeClaims: boolean;
  allowObjectives: boolean;
  allowWants: boolean;
  allowOffers: boolean;
  allowRelationships: boolean;
  allowIntroductions: boolean;
  allowOutcomes: boolean;
  allowTasks: boolean;
  maxRecentInteractions: number;
  maxKnowledgeClaims: number;
  maxObjectives: number;
  maxWants: number;
  maxOffers: number;
};

export type AgentProfileSnapshot = {
  id: string;
  key: string;
  name: string;
  personaKey: string;
  purposeKey: string;
  deploymentScope: string;
  authorityLevel: string;
};

function requireAgentContext(context: CoreAccessContext) {
  if (context.actorType !== 'AGENT') throw new Error('Agent data-access policy requires an agent Core context.');
}

export async function loadAgentAccessProfile(context: CoreAccessContext): Promise<{
  agent: AgentProfileSnapshot;
  policy: AgentDataAccessPolicySnapshot;
}> {
  requireAgentContext(context);

  const agent = await prisma.agentDefinition.findFirst({
    where: { id: context.actorId, userId: context.workspaceUserId, status: 'active' },
    select: {
      id: true,
      key: true,
      name: true,
      personaKey: true,
      purposeKey: true,
      deploymentScope: true,
      authorityLevel: true,
      dataAccessPolicy: {
        select: {
          id: true,
          scopeKey: true,
          allowContacts: true,
          allowCompanies: true,
          allowDeals: true,
          allowProjects: true,
          allowPeople: true,
          allowIdentity: true,
          allowContactMethods: true,
          allowInteractions: true,
          allowKnowledgeClaims: true,
          allowObjectives: true,
          allowWants: true,
          allowOffers: true,
          allowRelationships: true,
          allowIntroductions: true,
          allowOutcomes: true,
          allowTasks: true,
          maxRecentInteractions: true,
          maxKnowledgeClaims: true,
          maxObjectives: true,
          maxWants: true,
          maxOffers: true
        }
      }
    }
  });

  if (!agent) throw new Error('Agent definition not found in this workspace.');
  if (!agent.dataAccessPolicy) throw new Error('Agent has no relationship-data access policy.');

  // IT: The Core access purpose is the operation being attempted. The durable agent purpose
  // is stored separately and cannot be changed by a tool caller.
  return {
    agent: {
      id: agent.id,
      key: agent.key,
      name: agent.name,
      personaKey: agent.personaKey,
      purposeKey: agent.purposeKey,
      deploymentScope: agent.deploymentScope,
      authorityLevel: agent.authorityLevel
    },
    policy: agent.dataAccessPolicy
  };
}

export function agentMayReadEntity(policy: AgentDataAccessPolicySnapshot, entityType: AgentReadableEntityType) {
  switch (entityType) {
    case 'contact': return policy.allowContacts;
    case 'company': return policy.allowCompanies;
    case 'deal': return policy.allowDeals;
    case 'project': return policy.allowProjects;
    case 'person': return policy.allowPeople;
  }
}

export function assertAgentMayReadEntity(policy: AgentDataAccessPolicySnapshot, entityType: AgentReadableEntityType) {
  if (!agentMayReadEntity(policy, entityType)) {
    throw new Error(`Agent data policy does not permit ${entityType} relationship data.`);
  }
}

// IT: Compatibility filter for the pre-8.5 read_entity_context tool. The read is still tenant-scoped,
// and this removes sections the agent is not permitted to receive. New agent memory should use
// buildAgentMemoryProjection, which only loads permitted memory sections in the first place.
export function filterEntityContextForAgentPolicy(input: Record<string, any>, policy: AgentDataAccessPolicySnapshot) {
  const result: Record<string, any> = { ...input };

  if (!policy.allowIdentity) {
    for (const key of ['name', 'title', 'description', 'descriptionSummary', 'industry', 'location', 'kind', 'status', 'criteria', 'notes', 'company', 'position']) {
      delete result[key];
    }
  }
  if (!policy.allowContactMethods) {
    for (const key of ['email', 'phone', 'linkedin', 'website']) delete result[key];
    if (Array.isArray(result.people)) result.people = result.people.map(({ email, phone, linkedin, ...row }: any) => row);
    if (Array.isArray(result.employees)) result.employees = result.employees.map(({ email, phone, linkedin, ...row }: any) => row);
  }
  if (!policy.allowCompanies) {
    for (const key of ['companies', 'relatedCompanies', 'employees']) delete result[key];
  }
  if (!policy.allowDeals) {
    for (const key of ['deals', 'relatedDeals']) delete result[key];
  }
  if (!policy.allowInteractions) {
    for (const key of ['recentInteractions', 'recentNotes']) delete result[key];
  }
  if (!policy.allowRelationships) {
    for (const key of ['relationships', 'people', 'relatedPeople']) delete result[key];
  }
  if (!policy.allowTasks) {
    for (const key of ['openTasks', 'completedTasks']) delete result[key];
  }
  if (!policy.allowWants) delete result.wants;
  if (!policy.allowOffers) delete result.offers;
  if (!policy.allowWants && !policy.allowOffers) delete result.wantsOffers;
  else if (Array.isArray(result.wantsOffers)) {
    result.wantsOffers = result.wantsOffers.filter((row: any) =>
      (row?.type === 'WANT' && policy.allowWants) || (row?.type === 'OFFER' && policy.allowOffers)
    );
  }

  return result;
}
