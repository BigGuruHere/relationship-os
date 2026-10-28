-- Stage 8.20.1: immutable audit of authorised operator recovery transitions.
-- No audio, transcripts, phone identifiers, encryption keys or private LU text.
CREATE TABLE "DorianCallRecoveryEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "agentBindingId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "participantUserId" TEXT NOT NULL,
    "contextSpaceId" TEXT NOT NULL,
    "operation" VARCHAR(32) NOT NULL,
    "reasonCode" VARCHAR(48) NOT NULL,
    "previousState" VARCHAR(32),
    "nextState" VARCHAR(32),
    "previousOutcome" VARCHAR(32),
    "nextOutcome" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DorianCallRecoveryEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DorianCallRecoveryEvent_agentBindingId_createdAt_idx"
    ON "DorianCallRecoveryEvent"("agentBindingId", "createdAt");
CREATE INDEX "DorianCallRecoveryEvent_sessionId_createdAt_idx"
    ON "DorianCallRecoveryEvent"("sessionId", "createdAt");
