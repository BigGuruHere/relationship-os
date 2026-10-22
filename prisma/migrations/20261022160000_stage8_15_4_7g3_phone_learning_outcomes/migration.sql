-- Call-scoped processing outcomes are separate from the current caller readiness gate.
ALTER TABLE "NetworkDorianSession"
  ADD COLUMN "understandingOutcome" TEXT,
  ADD COLUMN "understandingOutcomeAt" TIMESTAMP(3);
