-- CreateEnum
CREATE TYPE "public"."LeadStatus" AS ENUM ('PENDING', 'CLAIMED');

-- AlterTable
ALTER TABLE "public"."Contact" ADD COLUMN     "linkedUserId" TEXT;

-- CreateTable
CREATE TABLE "public"."Lead" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "emailIdx" VARCHAR(128),
    "phoneIdx" VARCHAR(128),
    "status" "public"."LeadStatus" NOT NULL DEFAULT 'PENDING',
    "claimedByUserId" TEXT,
    "inviteToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_ownerId_idx" ON "public"."Lead"("ownerId");

-- CreateIndex
CREATE INDEX "Lead_emailIdx_idx" ON "public"."Lead"("emailIdx");

-- CreateIndex
CREATE INDEX "Lead_phoneIdx_idx" ON "public"."Lead"("phoneIdx");
