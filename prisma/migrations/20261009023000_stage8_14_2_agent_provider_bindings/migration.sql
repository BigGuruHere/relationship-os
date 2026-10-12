-- Stage 8.14.2: stable Relish agent identity with replaceable external provider bindings.
BEGIN;

CREATE TABLE "public"."AgentProviderBinding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentDefinitionId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'ELEVENLABS',
  "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
  "providerAgentIdEnc" TEXT,
  "providerAgentIdIdx" VARCHAR(128),
  "inboundPhoneEnc" TEXT,
  "inboundPhoneIdx" VARCHAR(128),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentProviderBinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentProviderBinding_userId_provider_environment_isActive_idx"
  ON "public"."AgentProviderBinding"("userId", "provider", "environment", "isActive");
CREATE INDEX "AgentProviderBinding_provider_providerAgentIdIdx_isActive_idx"
  ON "public"."AgentProviderBinding"("provider", "providerAgentIdIdx", "isActive");
CREATE INDEX "AgentProviderBinding_provider_inboundPhoneIdx_isActive_idx"
  ON "public"."AgentProviderBinding"("provider", "inboundPhoneIdx", "isActive");
CREATE INDEX "AgentProviderBinding_userId_contextSpaceId_idx"
  ON "public"."AgentProviderBinding"("userId", "contextSpaceId");
CREATE INDEX "AgentProviderBinding_agentDefinitionId_isActive_idx"
  ON "public"."AgentProviderBinding"("agentDefinitionId", "isActive");

ALTER TABLE "public"."AgentProviderBinding"
  ADD CONSTRAINT "AgentProviderBinding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."AgentProviderBinding"
  ADD CONSTRAINT "AgentProviderBinding_agentDefinitionId_fkey"
  FOREIGN KEY ("agentDefinitionId") REFERENCES "public"."AgentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."AgentProviderBinding"
  ADD CONSTRAINT "AgentProviderBinding_contextSpaceId_fkey"
  FOREIGN KEY ("contextSpaceId") REFERENCES "public"."ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
