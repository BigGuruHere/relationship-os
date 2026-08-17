-- Stage 5.2 quality fixes: task focus, company phone/tags, and project notes.

CREATE TYPE "TaskFocus" AS ENUM ('DOING_NOW', 'NOT_DOING_NOW', 'NEVER_DOING_NOW');

ALTER TABLE "Task"
ADD COLUMN "focus" "TaskFocus" NOT NULL DEFAULT 'NOT_DOING_NOW';

ALTER TABLE "Company"
ADD COLUMN "phoneEnc" TEXT,
ADD COLUMN "phoneIdx" TEXT;

CREATE INDEX "Company_phoneIdx_idx" ON "Company"("phoneIdx");
CREATE INDEX "Task_userId_focus_dueAt_idx" ON "Task"("userId", "focus", "dueAt");

CREATE TABLE "CompanyTag" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "assignedBy" "AssignedBy" NOT NULL DEFAULT 'user',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyTag_companyId_tagId_key" ON "CompanyTag"("companyId", "tagId");
CREATE INDEX "CompanyTag_userId_idx" ON "CompanyTag"("userId");
CREATE INDEX "CompanyTag_companyId_idx" ON "CompanyTag"("companyId");
CREATE INDEX "CompanyTag_tagId_idx" ON "CompanyTag"("tagId");

ALTER TABLE "CompanyTag"
ADD CONSTRAINT "CompanyTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyTag"
ADD CONSTRAINT "CompanyTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyTag"
ADD CONSTRAINT "CompanyTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjectNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "bodyEnc" TEXT NOT NULL,
  "summaryEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectNote_userId_projectId_createdAt_idx" ON "ProjectNote"("userId", "projectId", "createdAt");

ALTER TABLE "ProjectNote"
ADD CONSTRAINT "ProjectNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectNote"
ADD CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
