-- PURPOSE: introduce normalized tags and make Interaction.updatedAt safe for existing rows

BEGIN;

-- 1) Create core Tag tables
CREATE TABLE "Tag" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mergedIntoId" TEXT
);

-- unique constraints for Tag
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_slug_key" UNIQUE ("slug");
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_name_key" UNIQUE ("name");

-- self relation for merges
ALTER TABLE "Tag"
  ADD CONSTRAINT "Tag_mergedInto_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "Tag"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) Aliases
CREATE TABLE "TagAlias" (
  "id" TEXT PRIMARY KEY,
  "tagId" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "slug" TEXT NOT NULL
);

ALTER TABLE "TagAlias"
  ADD CONSTRAINT "TagAlias_slug_key" UNIQUE ("slug");

ALTER TABLE "TagAlias"
  ADD CONSTRAINT "TagAlias_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Join table: ContactTag
CREATE TABLE "ContactTag" (
  "contactId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "assignedBy" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("contactId", "tagId")
);

CREATE INDEX "ContactTag_tagId_idx" ON "ContactTag"("tagId");

ALTER TABLE "ContactTag"
  ADD CONSTRAINT "ContactTag_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactTag"
  ADD CONSTRAINT "ContactTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Join table: InteractionTag
CREATE TABLE "InteractionTag" (
  "interactionId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "assignedBy" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractionTag_pkey" PRIMARY KEY ("interactionId", "tagId")
);

CREATE INDEX "InteractionTag_tagId_idx" ON "InteractionTag"("tagId");

ALTER TABLE "InteractionTag"
  ADD CONSTRAINT "InteractionTag_interactionId_fkey"
  FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InteractionTag"
  ADD CONSTRAINT "InteractionTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Make Interaction.updatedAt safe for existing rows
-- add column if missing, seed values, then set NOT NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Interaction' AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "Interaction" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END$$;

UPDATE "Interaction"
SET "updatedAt" = NOW()
WHERE "updatedAt" IS NULL;

ALTER TABLE "Interaction" ALTER COLUMN "updatedAt" SET NOT NULL;

-- optional: add summaryEnc column if you want it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Interaction' AND column_name = 'summaryEnc'
  ) THEN
    ALTER TABLE "Interaction" ADD COLUMN "summaryEnc" TEXT;
  END IF;
END$$;

-- 6) Drop legacy Contact.tags array if it exists
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "tags";

COMMIT;
