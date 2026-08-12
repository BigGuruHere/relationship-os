// src/lib/server/agents/artifacts.ts
// PURPOSE: Load decrypted agent artifacts for entity pages and run pages.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import type { AgentEntityType } from '$lib/server/agents/types';

function safeDecryptArtifact(payload: string | null | undefined, aad: string, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, aad);
  } catch {
    return fallback;
  }
}

export async function loadAgentArtifacts(params: {
  userId: string;
  entityType?: AgentEntityType;
  entityId?: string;
  agentRunId?: string;
  take?: number;
}) {
  const rows = await prisma.agentArtifact.findMany({
    where: {
      userId: params.userId,
      ...(params.entityType && params.entityId ? { entityType: params.entityType, entityId: params.entityId } : {}),
      ...(params.agentRunId ? { agentRunId: params.agentRunId } : {})
    },
    select: {
      id: true,
      agentRunId: true,
      artifactType: true,
      title: true,
      contentEnc: true,
      summaryEnc: true,
      structuredJson: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: params.take ?? 10
  });

  return rows.map((row) => ({
    id: row.id,
    runId: row.agentRunId,
    artifactType: row.artifactType,
    title: row.title,
    content: safeDecryptArtifact(row.contentEnc, 'agent_artifact.content', ''),
    summary: safeDecryptArtifact(row.summaryEnc, 'agent_artifact.summary', ''),
    structuredJson: row.structuredJson,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}
