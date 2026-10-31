-- Stage 8.22.3: record all recognised voice initiations independently of participant sessions.
CREATE TABLE "DorianVoiceCallLifecycle" (
  "conversationId" VARCHAR(120) NOT NULL,
  "callerId" TEXT,
  "agentBindingId" VARCHAR(120),
  "mode" VARCHAR(24) NOT NULL DEFAULT 'UNRESOLVED',
  "callState" VARCHAR(16) NOT NULL DEFAULT 'STARTED',
  "understandingState" VARCHAR(24) NOT NULL DEFAULT 'NOT_REQUIRED',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DorianVoiceCallLifecycle_pkey" PRIMARY KEY ("conversationId")
);
CREATE INDEX "DorianVoiceCallLifecycle_callerId_startedAt_idx" ON "DorianVoiceCallLifecycle"("callerId", "startedAt");
CREATE INDEX "DorianVoiceCallLifecycle_callState_startedAt_idx" ON "DorianVoiceCallLifecycle"("callState", "startedAt");
