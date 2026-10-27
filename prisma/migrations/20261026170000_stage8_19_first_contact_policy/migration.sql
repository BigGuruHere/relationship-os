-- Stage 8.19 - A versioned consent event belongs to the participant, never the inviter.
CREATE TABLE "RelishCallPolicyAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyVersion" VARCHAR(60) NOT NULL,
    "termsUrl" TEXT NOT NULL,
    "privacyUrl" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'VOICE_EXPLICIT',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RelishCallPolicyAcceptance_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "RelishCallPolicyAcceptance"
  ADD CONSTRAINT "RelishCallPolicyAcceptance_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "RelishCallPolicyAcceptance_sessionId_policyVersion_key"
  ON "RelishCallPolicyAcceptance"("sessionId", "policyVersion");
CREATE INDEX "RelishCallPolicyAcceptance_userId_policyVersion_acceptedAt_idx"
  ON "RelishCallPolicyAcceptance"("userId", "policyVersion", "acceptedAt");
