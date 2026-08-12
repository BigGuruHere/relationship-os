-- IT: Extend deal-contact links into commercial conversation records and add a unified task/project layer.

CREATE TYPE "DealContactStage" AS ENUM (
  'NOT_CONTACTED',
  'CONTACTED',
  'TEASER_SENT',
  'NDA_SENT',
  'NDA_SIGNED',
  'IM_SENT',
  'MEETING_BOOKED',
  'REVIEWING',
  'OFFER_EXPECTED',
  'OFFER_MADE',
  'DECLINED',
  'NOT_SUITABLE',
  'DORMANT'
);

CREATE TYPE "DealContactInterest" AS ENUM (
  'UNKNOWN',
  'COLD',
  'WARM',
  'HOT',
  'STRONG_FIT',
  'NOT_A_FIT'
);

CREATE TYPE "DealConfidentialityStage" AS ENUM (
  'NONE',
  'BLIND_TEASER_SENT',
  'NDA_SENT',
  'NDA_SIGNED',
  'IM_SENT',
  'DATA_ROOM_ACCESS',
  'VENDOR_APPROVED'
);

CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED', 'DONE', 'CANCELLED');
CREATE TYPE "TaskUrgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "TaskImportance" AS ENUM ('LOW', 'NORMAL', 'HIGH');
CREATE TYPE "TaskType" AS ENUM (
  'FOLLOW_UP',
  'CALL',
  'EMAIL',
  'SEND_DOCUMENT',
  'BOOK_MEETING',
  'RESEARCH',
  'PREPARE',
  'REVIEW',
  'INTRODUCE',
  'DECISION',
  'ADMIN',
  'PERSONAL_TODO',
  'DEAL_STEP',
  'CUSTOM'
);

ALTER TABLE "DealContact"
  ADD COLUMN "stage" "DealContactStage" NOT NULL DEFAULT 'NOT_CONTACTED',
  ADD COLUMN "interestLevel" "DealContactInterest" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "confidentialityStage" "DealConfidentialityStage" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "nextActionEnc" TEXT,
  ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "lastContactedAt" TIMESTAMP(3),
  ADD COLUMN "buyingCriteriaEnc" TEXT,
  ADD COLUMN "objectionsEnc" TEXT,
  ADD COLUMN "fundingCapacityEnc" TEXT,
  ADD COLUMN "referralPathEnc" TEXT;

CREATE INDEX "DealContact_userId_stage_idx" ON "DealContact"("userId", "stage");
CREATE INDEX "DealContact_userId_interestLevel_idx" ON "DealContact"("userId", "interestLevel");
CREATE INDEX "DealContact_userId_nextFollowUpAt_idx" ON "DealContact"("userId", "nextFollowUpAt");

CREATE TABLE "DealContactNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dealContactId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "contactId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" TEXT NOT NULL DEFAULT 'note',
  "rawTextEnc" TEXT NOT NULL,
  "summaryEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealContactNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DealContactNote_userId_dealContactId_occurredAt_idx" ON "DealContactNote"("userId", "dealContactId", "occurredAt");
CREATE INDEX "DealContactNote_userId_dealId_occurredAt_idx" ON "DealContactNote"("userId", "dealId", "occurredAt");
CREATE INDEX "DealContactNote_userId_contactId_occurredAt_idx" ON "DealContactNote"("userId", "contactId", "occurredAt");

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "titleEnc" TEXT NOT NULL,
  "titleIdx" TEXT NOT NULL,
  "descriptionEnc" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_userId_status_idx" ON "Project"("userId", "status");
CREATE INDEX "Project_titleIdx_idx" ON "Project"("titleIdx");

CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "titleEnc" TEXT NOT NULL,
  "notesEnc" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "urgency" "TaskUrgency" NOT NULL DEFAULT 'NORMAL',
  "importance" "TaskImportance" NOT NULL DEFAULT 'NORMAL',
  "taskType" "TaskType" NOT NULL DEFAULT 'FOLLOW_UP',
  "dueAt" TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "assignedToTextEnc" TEXT,
  "assignedToContactId" TEXT,
  "waitingOnContactId" TEXT,
  "contactId" TEXT,
  "dealId" TEXT,
  "dealContactId" TEXT,
  "projectId" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_userId_status_dueAt_idx" ON "Task"("userId", "status", "dueAt");
CREATE INDEX "Task_userId_urgency_idx" ON "Task"("userId", "urgency");
CREATE INDEX "Task_userId_contactId_idx" ON "Task"("userId", "contactId");
CREATE INDEX "Task_userId_dealId_idx" ON "Task"("userId", "dealId");
CREATE INDEX "Task_userId_dealContactId_idx" ON "Task"("userId", "dealContactId");
CREATE INDEX "Task_userId_projectId_idx" ON "Task"("userId", "projectId");
CREATE INDEX "Task_userId_waitingOnContactId_idx" ON "Task"("userId", "waitingOnContactId");

ALTER TABLE "DealContactNote" ADD CONSTRAINT "DealContactNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealContactNote" ADD CONSTRAINT "DealContactNote_dealContactId_fkey" FOREIGN KEY ("dealContactId") REFERENCES "DealContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealContactNote" ADD CONSTRAINT "DealContactNote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealContactNote" ADD CONSTRAINT "DealContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToContactId_fkey" FOREIGN KEY ("assignedToContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_waitingOnContactId_fkey" FOREIGN KEY ("waitingOnContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealContactId_fkey" FOREIGN KEY ("dealContactId") REFERENCES "DealContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
