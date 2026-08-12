-- CreateEnum
CREATE TYPE "public"."RelationshipType" AS ENUM ('WORKS_WITH', 'REPORTS_TO', 'MANAGES', 'COLLEAGUE', 'CLIENT', 'VENDOR', 'PARTNER', 'SPOUSE', 'FAMILY', 'FRIEND', 'ACQUAINTANCE', 'INTRODUCED_BY', 'MET_THROUGH', 'CUSTOM');

-- CreateTable
CREATE TABLE "public"."ContactRelationship" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactAId" TEXT NOT NULL,
    "contactBId" TEXT NOT NULL,
    "relationshipType" "public"."RelationshipType",
    "label" TEXT DEFAULT 'knows',
    "metadata" JSONB,
    "isDirectional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactRelationship_userId_contactAId_idx" ON "public"."ContactRelationship"("userId", "contactAId");

-- CreateIndex
CREATE INDEX "ContactRelationship_userId_contactBId_idx" ON "public"."ContactRelationship"("userId", "contactBId");

-- CreateIndex
CREATE INDEX "ContactRelationship_userId_relationshipType_idx" ON "public"."ContactRelationship"("userId", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "ContactRelationship_userId_contactAId_contactBId_relationsh_key" ON "public"."ContactRelationship"("userId", "contactAId", "contactBId", "relationshipType", "label");

-- AddForeignKey
ALTER TABLE "public"."ContactRelationship" ADD CONSTRAINT "ContactRelationship_contactAId_fkey" FOREIGN KEY ("contactAId") REFERENCES "public"."Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContactRelationship" ADD CONSTRAINT "ContactRelationship_contactBId_fkey" FOREIGN KEY ("contactBId") REFERENCES "public"."Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContactRelationship" ADD CONSTRAINT "ContactRelationship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
