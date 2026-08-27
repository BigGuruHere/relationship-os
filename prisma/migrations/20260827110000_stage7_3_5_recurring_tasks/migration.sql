-- Stage 7.3.5 - Recurring Tasks
-- IT: Adds recurrence metadata only. Existing tasks are untouched and remain non-recurring.

CREATE TYPE "TaskRecurrenceRule" AS ENUM ('DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY');

ALTER TABLE "Task"
  ADD COLUMN "recurrenceRule" "TaskRecurrenceRule",
  ADD COLUMN "recurrenceSeriesId" TEXT,
  ADD COLUMN "recurrenceAnchorAt" TIMESTAMP(3);

CREATE INDEX "Task_userId_recurrenceSeriesId_status_idx"
  ON "Task"("userId", "recurrenceSeriesId", "status");
