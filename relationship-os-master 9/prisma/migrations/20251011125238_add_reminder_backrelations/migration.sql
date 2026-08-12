/*
  Warnings:

  - You are about to drop the `InteractionTag` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."InteractionTag" DROP CONSTRAINT "InteractionTag_interactionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InteractionTag" DROP CONSTRAINT "InteractionTag_tagId_fkey";

-- DropIndex
DROP INDEX "public"."interaction_vec_hnsw";

-- DropIndex
DROP INDEX "public"."tag_vec_hnsw";

-- AlterTable
ALTER TABLE "public"."Contact" ADD COLUMN     "companyEnc" TEXT,
ADD COLUMN     "companyIdx" TEXT,
ADD COLUMN     "lastContactedAt" TIMESTAMP(3),
ADD COLUMN     "reconnectEveryDays" INTEGER;

-- DropTable
DROP TABLE "public"."InteractionTag";

-- CreateTable
CREATE TABLE "public"."Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_userId_dueAt_idx" ON "public"."Reminder"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_userId_contactId_dueAt_idx" ON "public"."Reminder"("userId", "contactId", "dueAt");

-- CreateIndex
CREATE INDEX "Contact_companyIdx_idx" ON "public"."Contact"("companyIdx");

-- AddForeignKey
ALTER TABLE "public"."Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reminder" ADD CONSTRAINT "Reminder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
