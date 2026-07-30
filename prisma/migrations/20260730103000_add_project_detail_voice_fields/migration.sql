-- IT: Add summary fields used by voice-enabled deal creation and task notes.
ALTER TABLE "Deal"
  ADD COLUMN IF NOT EXISTS "descriptionSummaryEnc" TEXT;

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "summaryEnc" TEXT;
