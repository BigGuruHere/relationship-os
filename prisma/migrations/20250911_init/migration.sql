-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."CreatedBy" AS ENUM ('ai', 'user');

-- CreateEnum
CREATE TYPE "public"."AssignedBy" AS ENUM ('ai', 'user');

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdBy" "public"."CreatedBy" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mergedIntoId" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TagAlias" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "TagAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contact" (
    "id" TEXT NOT NULL,
    "fullNameEnc" TEXT NOT NULL,
    "emailEnc" TEXT,
    "phoneEnc" TEXT,
    "fullNameIdx" TEXT NOT NULL,
    "emailIdx" TEXT,
    "phoneIdx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Interaction" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "rawTextEnc" TEXT NOT NULL,
    "summaryEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContactTag" (
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedBy" "public"."AssignedBy" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("contactId","tagId")
);

-- CreateTable
CREATE TABLE "public"."InteractionTag" (
    "interactionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedBy" "public"."AssignedBy" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionTag_pkey" PRIMARY KEY ("interactionId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "public"."Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_createdBy_createdAt_idx" ON "public"."Tag"("createdBy", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "public"."Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TagAlias_slug_key" ON "public"."TagAlias"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TagAlias_tagId_slug_key" ON "public"."TagAlias"("tagId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_emailIdx_key" ON "public"."Contact"("emailIdx");

-- CreateIndex
CREATE INDEX "Contact_fullNameIdx_idx" ON "public"."Contact"("fullNameIdx");

-- CreateIndex
CREATE INDEX "Contact_phoneIdx_idx" ON "public"."Contact"("phoneIdx");

-- CreateIndex
CREATE INDEX "ContactTag_tagId_idx" ON "public"."ContactTag"("tagId");

-- CreateIndex
CREATE INDEX "InteractionTag_tagId_idx" ON "public"."InteractionTag"("tagId");

-- AddForeignKey
ALTER TABLE "public"."Tag" ADD CONSTRAINT "Tag_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "public"."Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAlias" ADD CONSTRAINT "TagAlias_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Interaction" ADD CONSTRAINT "Interaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContactTag" ADD CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InteractionTag" ADD CONSTRAINT "InteractionTag_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "public"."Interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InteractionTag" ADD CONSTRAINT "InteractionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

