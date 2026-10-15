-- Stage 8.15.4.6: single-use shared-agent custody mapping.
CREATE TABLE "NetworkDorianSession" (
 "id" TEXT NOT NULL,
 "tokenHash" VARCHAR(64) NOT NULL,
 "userId" TEXT NOT NULL,
 "contextSpaceId" TEXT NOT NULL,
 "contactId" TEXT NOT NULL,
 "agentBindingId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "conversationId" TEXT,
 CONSTRAINT "NetworkDorianSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NetworkDorianSession_tokenHash_key" ON "NetworkDorianSession"("tokenHash");
CREATE UNIQUE INDEX "NetworkDorianSession_conversationId_key" ON "NetworkDorianSession"("conversationId");
CREATE INDEX "NetworkDorianSession_userId_contextSpaceId_createdAt_idx" ON "NetworkDorianSession"("userId", "contextSpaceId", "createdAt");
CREATE INDEX "NetworkDorianSession_agentBindingId_expiresAt_idx" ON "NetworkDorianSession"("agentBindingId", "expiresAt");
