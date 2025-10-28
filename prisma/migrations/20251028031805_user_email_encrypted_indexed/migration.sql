/*
  Warnings:

  - You are about to drop the column `email` on the `OAuthAccount` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."User_email_key";

-- AlterTable
ALTER TABLE "public"."OAuthAccount" DROP COLUMN "email";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "email";

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");
