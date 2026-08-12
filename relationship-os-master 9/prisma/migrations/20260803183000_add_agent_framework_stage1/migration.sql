-- IT: Stage 1 Agent Framework foundation.
-- IT: Adds generic agent definitions, prompt versions, tool permissions, runs, steps, tool/model logs, artifacts, approvals, and entity links.

CREATE TABLE "AgentDefinition" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'general',
  "status" TEXT NOT NULL DEFAULT 'active',
  "defaultModelProvider" TEXT NOT NULL DEFAULT 'openai',
  "defaultModelName" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "systemPrompt" TEXT NOT NULL,
  "instructions" TEXT,
  "outputSchemaJson" JSONB,
  "requiresApprovalDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentPromptVersion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentDefinitionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "instructions" TEXT,
  "outputSchemaJson" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT NOT NULL DEFAULT 'system',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentPromptVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentToolDefinition" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "toolType" TEXT NOT NULL DEFAULT 'read',
  "inputSchemaJson" JSONB,
  "outputSchemaJson" JSONB,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentToolDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentToolPermission" (
  "id" TEXT NOT NULL,
  "agentDefinitionId" TEXT NOT NULL,
  "toolDefinitionId" TEXT NOT NULL,
  "permissionLevel" TEXT NOT NULL DEFAULT 'read',
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "constraintsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentToolPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentDefinitionId" TEXT NOT NULL,
  "promptVersionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "triggerType" TEXT NOT NULL DEFAULT 'manual',
  "triggerEntityType" TEXT,
  "triggerEntityId" TEXT,
  "inputJson" JSONB,
  "resultJson" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentStep" (
  "id" TEXT NOT NULL,
  "agentRunId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "stepName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "inputJson" JSONB,
  "outputJson" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentToolCall" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentRunId" TEXT NOT NULL,
  "agentStepId" TEXT,
  "toolKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "inputJson" JSONB,
  "outputJson" JSONB,
  "errorMessage" TEXT,
  "createdEntityType" TEXT,
  "createdEntityId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelInvocation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentRunId" TEXT,
  "agentStepId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "purpose" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "costEstimate" DECIMAL(12,6),
  "requestJsonRedacted" JSONB,
  "responseJsonRedacted" JSONB,
  "structuredOutputJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'success',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelInvocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentArtifact" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentRunId" TEXT,
  "agentStepId" TEXT,
  "artifactType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "contentEnc" TEXT,
  "summaryEnc" TEXT,
  "structuredJson" JSONB,
  "entityType" TEXT,
  "entityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentRunId" TEXT,
  "agentStepId" TEXT,
  "actionType" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "proposedActionJson" JSONB,
  "proposedDiffJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewerNote" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRunEntity" (
  "id" TEXT NOT NULL,
  "agentRunId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'referenced',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentRunEntity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentDefinition_userId_key_key" ON "AgentDefinition"("userId", "key");
CREATE INDEX "AgentDefinition_userId_status_idx" ON "AgentDefinition"("userId", "status");
CREATE INDEX "AgentDefinition_userId_category_idx" ON "AgentDefinition"("userId", "category");

CREATE UNIQUE INDEX "AgentPromptVersion_agentDefinitionId_version_key" ON "AgentPromptVersion"("agentDefinitionId", "version");
CREATE INDEX "AgentPromptVersion_userId_agentDefinitionId_isActive_idx" ON "AgentPromptVersion"("userId", "agentDefinitionId", "isActive");

CREATE UNIQUE INDEX "AgentToolDefinition_userId_key_key" ON "AgentToolDefinition"("userId", "key");
CREATE INDEX "AgentToolDefinition_userId_toolType_idx" ON "AgentToolDefinition"("userId", "toolType");
CREATE INDEX "AgentToolDefinition_userId_isEnabled_idx" ON "AgentToolDefinition"("userId", "isEnabled");

CREATE UNIQUE INDEX "AgentToolPermission_agentDefinitionId_toolDefinitionId_key" ON "AgentToolPermission"("agentDefinitionId", "toolDefinitionId");
CREATE INDEX "AgentToolPermission_toolDefinitionId_idx" ON "AgentToolPermission"("toolDefinitionId");

CREATE INDEX "AgentRun_userId_status_idx" ON "AgentRun"("userId", "status");
CREATE INDEX "AgentRun_userId_agentDefinitionId_idx" ON "AgentRun"("userId", "agentDefinitionId");
CREATE INDEX "AgentRun_triggerEntityType_triggerEntityId_idx" ON "AgentRun"("triggerEntityType", "triggerEntityId");
CREATE INDEX "AgentRun_createdAt_idx" ON "AgentRun"("createdAt");

CREATE INDEX "AgentStep_agentRunId_status_idx" ON "AgentStep"("agentRunId", "status");
CREATE INDEX "AgentStep_stepKey_idx" ON "AgentStep"("stepKey");

CREATE INDEX "AgentToolCall_userId_toolKey_idx" ON "AgentToolCall"("userId", "toolKey");
CREATE INDEX "AgentToolCall_agentRunId_idx" ON "AgentToolCall"("agentRunId");
CREATE INDEX "AgentToolCall_agentStepId_idx" ON "AgentToolCall"("agentStepId");

CREATE INDEX "ModelInvocation_userId_provider_idx" ON "ModelInvocation"("userId", "provider");
CREATE INDEX "ModelInvocation_agentRunId_idx" ON "ModelInvocation"("agentRunId");
CREATE INDEX "ModelInvocation_agentStepId_idx" ON "ModelInvocation"("agentStepId");

CREATE INDEX "AgentArtifact_userId_artifactType_idx" ON "AgentArtifact"("userId", "artifactType");
CREATE INDEX "AgentArtifact_userId_entityType_entityId_idx" ON "AgentArtifact"("userId", "entityType", "entityId");
CREATE INDEX "AgentArtifact_agentRunId_idx" ON "AgentArtifact"("agentRunId");

CREATE INDEX "ApprovalRequest_userId_status_idx" ON "ApprovalRequest"("userId", "status");
CREATE INDEX "ApprovalRequest_agentRunId_idx" ON "ApprovalRequest"("agentRunId");
CREATE INDEX "ApprovalRequest_entityType_entityId_idx" ON "ApprovalRequest"("entityType", "entityId");

CREATE INDEX "AgentRunEntity_agentRunId_idx" ON "AgentRunEntity"("agentRunId");
CREATE INDEX "AgentRunEntity_entityType_entityId_idx" ON "AgentRunEntity"("entityType", "entityId");

ALTER TABLE "AgentDefinition" ADD CONSTRAINT "AgentDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPromptVersion" ADD CONSTRAINT "AgentPromptVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPromptVersion" ADD CONSTRAINT "AgentPromptVersion_agentDefinitionId_fkey" FOREIGN KEY ("agentDefinitionId") REFERENCES "AgentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentToolDefinition" ADD CONSTRAINT "AgentToolDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentToolPermission" ADD CONSTRAINT "AgentToolPermission_agentDefinitionId_fkey" FOREIGN KEY ("agentDefinitionId") REFERENCES "AgentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentToolPermission" ADD CONSTRAINT "AgentToolPermission_toolDefinitionId_fkey" FOREIGN KEY ("toolDefinitionId") REFERENCES "AgentToolDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentDefinitionId_fkey" FOREIGN KEY ("agentDefinitionId") REFERENCES "AgentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "AgentPromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentStep" ADD CONSTRAINT "AgentStep_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_agentStepId_fkey" FOREIGN KEY ("agentStepId") REFERENCES "AgentStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModelInvocation" ADD CONSTRAINT "ModelInvocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelInvocation" ADD CONSTRAINT "ModelInvocation_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModelInvocation" ADD CONSTRAINT "ModelInvocation_agentStepId_fkey" FOREIGN KEY ("agentStepId") REFERENCES "AgentStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentRunEntity" ADD CONSTRAINT "AgentRunEntity_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
