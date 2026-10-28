-- Stage 8.20: cache of published conversational configuration only.
-- No contacts, phone identities, conversations, secrets or Living Understanding.
CREATE TABLE "DorianAgentConfigSnapshot" (
  "id" TEXT NOT NULL,
  "environment" VARCHAR(10) NOT NULL,
  "agentKey" VARCHAR(24) NOT NULL DEFAULT 'DORIAN',
  "revision" INTEGER NOT NULL,
  "content" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DorianAgentConfigSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DorianAgentConfigSnapshot_environment_agentKey_key"
 ON "DorianAgentConfigSnapshot"("environment", "agentKey");
