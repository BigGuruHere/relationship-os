/*
  Warnings:

  - A unique constraint covering the columns `[ownerId,linkedinIdx]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email_Idx]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Lead" ADD COLUMN     "linkedinEnc" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "email_Enc" TEXT,
ADD COLUMN     "email_Idx" BYTEA;

-- CreateIndex
CREATE INDEX "Lead_linkedinIdx_idx" ON "public"."Lead"("linkedinIdx");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_ownerId_linkedinIdx_key" ON "public"."Lead"("ownerId", "linkedinIdx");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_Idx_key" ON "public"."User"("email_Idx");
