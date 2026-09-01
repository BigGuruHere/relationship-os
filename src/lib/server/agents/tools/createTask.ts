// src/lib/server/agents/tools/createTask.ts
// PURPOSE: Create a Relish task as an agent action.

import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import type { ToolDefinition } from '$lib/server/agents/types';
import { createAgentCoreAccess } from '$lib/server/core/accessPolicy';
import { assertOwnedCanonicalRefs } from '$lib/server/core/relationshipRepository';

type CreateTaskInput = {
  title: string;
  notes?: string;
  status?: string;
  urgency?: string;
  importance?: string;
  taskType?: string;
  dueAt?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  projectId?: string;
  sourceType?: string;
  sourceId?: string;
};

type CreateTaskOutput = {
  id: string;
  createdEntityType: 'task';
  createdEntityId: string;
};

const STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED', 'DONE', 'CANCELLED']);
const URGENCIES = new Set(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']);
const IMPORTANCES = new Set(['LOW', 'NORMAL', 'HIGH']);
const TYPES = new Set(['FOLLOW_UP', 'CALL', 'EMAIL', 'SEND_DOCUMENT', 'BOOK_MEETING', 'RESEARCH', 'PREPARE', 'REVIEW', 'INTRODUCE', 'DECISION', 'ADMIN', 'PERSONAL_TODO', 'DEAL_STEP', 'CUSTOM']);

function optionalDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const createTaskTool: ToolDefinition<CreateTaskInput, CreateTaskOutput> = {
  key: 'create_task',
  description: 'Creates a Relish task for human review or follow-up.',
  requiresApproval: false,
  execute: async (input, context) => {
    const title = String(input.title || '').trim();
    if (!title) throw new Error('Task title is required.');

    // IT: Stage 8.1 prevents an agent from attaching a task to another tenant's relationship record.
    const access = createAgentCoreAccess({ userId: context.userId, contextSpaceId: context.contextSpaceId || context.userId, agentDefinitionId: context.agentDefinitionId, purpose: 'create_task' });
    await assertOwnedCanonicalRefs(access, { contactId: input.contactId, companyId: input.companyId, dealId: input.dealId, projectId: input.projectId });

    const task = await prisma.task.create({
      data: {
        userId: context.userId,
        contextSpaceId: context.contextSpaceId || context.userId,
        titleEnc: encrypt(title, 'task.title'),
        notesEnc: input.notes?.trim() ? encrypt(input.notes.trim(), 'task.notes') : null,
        status: STATUSES.has(String(input.status || '').toUpperCase()) ? String(input.status).toUpperCase() as any : 'OPEN',
        urgency: URGENCIES.has(String(input.urgency || '').toUpperCase()) ? String(input.urgency).toUpperCase() as any : 'NORMAL',
        importance: IMPORTANCES.has(String(input.importance || '').toUpperCase()) ? String(input.importance).toUpperCase() as any : 'NORMAL',
        taskType: TYPES.has(String(input.taskType || '').toUpperCase()) ? String(input.taskType).toUpperCase() as any : 'REVIEW',
        dueAt: optionalDate(input.dueAt),
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        dealId: input.dealId ?? null,
        projectId: input.projectId ?? null,
        sourceType: input.sourceType ?? 'agent',
        sourceId: input.sourceId ?? context.agentRunId
      }
    });

    await prisma.agentRunEntity.create({
      data: {
        agentRunId: context.agentRunId,
        entityType: 'task',
        entityId: task.id,
        role: 'created_task'
      }
    });

    return { id: task.id, createdEntityType: 'task', createdEntityId: task.id };
  }
};
