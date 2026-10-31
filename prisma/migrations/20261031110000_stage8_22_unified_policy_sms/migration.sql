-- Stage 8.22: deduplicate legal notice SMS submissions by provisional user and policy.
CREATE TABLE "RelishPolicySmsDispatch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "policyVersion" VARCHAR(60) NOT NULL,
  "legalUrl" TEXT NOT NULL,
  "state" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(80),
  CONSTRAINT "RelishPolicySmsDispatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RelishPolicySmsDispatch_userId_policyVersion_legalUrl_key"
 ON "RelishPolicySmsDispatch"("userId", "policyVersion", "legalUrl");
CREATE INDEX "RelishPolicySmsDispatch_attemptedAt_idx" ON "RelishPolicySmsDispatch"("attemptedAt");
