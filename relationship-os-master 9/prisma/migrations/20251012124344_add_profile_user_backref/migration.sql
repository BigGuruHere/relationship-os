-- CreateEnum
CREATE TYPE "public"."ProfileKind" AS ENUM ('business', 'personal', 'dating', 'custom');

-- CreateTable
CREATE TABLE "public"."Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "public"."ProfileKind" NOT NULL DEFAULT 'business',
    "label" TEXT NOT NULL DEFAULT 'My profile',
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "headline" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "company" TEXT,
    "title" TEXT,
    "websiteUrl" TEXT,
    "emailPublic" TEXT,
    "phonePublic" TEXT,
    "socials" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_slug_key" ON "public"."Profile"("slug");

-- CreateIndex
CREATE INDEX "Profile_userId_isDefault_idx" ON "public"."Profile"("userId", "isDefault");

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
