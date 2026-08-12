/*
  Warnings:

  - A unique constraint covering the columns `[publicSlug]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('owner', 'member', 'guest');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "publicSlug" TEXT,
ADD COLUMN     "role" "public"."UserRole" NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE "public"."MagicToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "MagicToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InviteToken" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MagicToken_tokenHash_key" ON "public"."MagicToken"("tokenHash");

-- CreateIndex
CREATE INDEX "MagicToken_userId_idx" ON "public"."MagicToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_tokenHash_key" ON "public"."InviteToken"("tokenHash");

-- CreateIndex
CREATE INDEX "InviteToken_ownerId_idx" ON "public"."InviteToken"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_publicSlug_key" ON "public"."User"("publicSlug");

-- AddForeignKey
ALTER TABLE "public"."MagicToken" ADD CONSTRAINT "MagicToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InviteToken" ADD CONSTRAINT "InviteToken_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
