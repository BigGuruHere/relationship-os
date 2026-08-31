// src/routes/agents/memory/+page.server.ts
// PURPOSE: Workspace-only inspector for the Stage 8.5 purpose-scoped derived memory projection.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { ensureCoreAgentSetup } from '$lib/server/agents/agentSetup';
import { createAgentCoreAccess } from '$lib/server/core/accessPolicy';
import { buildAgentMemoryProjection } from '$lib/server/core/agentMemory';
import { contactOptionsForRows } from '$lib/server/contactDisplay';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  await ensureCoreAgentSetup(userId);

  const [agents, contactRows] = await Promise.all([
    prisma.agentDefinition.findMany({
      where: { userId, status: 'active' },
      select: {
        id: true, key: true, name: true, personaKey: true, purposeKey: true,
        deploymentScope: true, authorityLevel: true,
        dataAccessPolicy: {
          select: {
            allowContacts: true, allowPeople: true, allowIdentity: true, allowContactMethods: true,
            allowInteractions: true, allowKnowledgeClaims: true, allowObjectives: true,
            allowWants: true, allowOffers: true, allowRelationships: true,
            allowIntroductions: true, allowOutcomes: true, allowTasks: true
          }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.contact.findMany({
      where: { userId },
      select: { id: true, fullNameEnc: true, linkedUserId: true },
      orderBy: { updatedAt: 'desc' },
      take: 200
    })
  ]);

  const contacts = await contactOptionsForRows(contactRows);
  const requestedAgentId = String(url.searchParams.get('agentId') || '').trim();
  const requestedContactId = String(url.searchParams.get('contactId') || '').trim();
  const selectedAgent = agents.find((agent) => agent.id === requestedAgentId) || agents[0] || null;
  const selectedContact = contacts.find((contact) => contact.id === requestedContactId) || contacts[0] || null;

  let projection: any = null;
  let error = '';
  if (selectedAgent && selectedContact) {
    try {
      const access = createAgentCoreAccess({
        userId,
        agentDefinitionId: selectedAgent.id,
        purpose: 'workspace_memory_preview'
      });
      projection = await buildAgentMemoryProjection({
        context: access,
        subjectType: 'contact',
        subjectId: selectedContact.id
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  return { agents, contacts, selectedAgentId: selectedAgent?.id ?? '', selectedContactId: selectedContact?.id ?? '', projection, error };
};
