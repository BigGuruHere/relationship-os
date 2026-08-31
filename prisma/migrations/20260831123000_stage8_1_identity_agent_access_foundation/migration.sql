-- Stage 8.1 - Identity + Agent Access Foundation
-- IT: Adds a neutral Person identity bridge without changing Contact tenant ownership.
-- Existing registered users are deterministically seeded into Person using their existing User.id.
-- Existing Contact.linkedUserId values are used to populate Contact.personId where they point to a current User.
-- No Contacts, Users, or relationship data are deleted or merged. linkedUserId remains in place as a compatibility bridge.

CREATE TABLE "Person" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "personId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "personId" TEXT;

-- IT: Existing User ids are already UUID-shaped stable identifiers, so reuse them for the initial Person rows.
INSERT INTO "Person" ("id", "createdAt", "updatedAt")
SELECT "id", "createdAt", "updatedAt"
FROM "User";

UPDATE "User"
SET "personId" = "id"
WHERE "personId" IS NULL;

-- IT: linkedUserId is the existing Relish account-to-contact bridge. Map it through User.personId, not by assumption.
UPDATE "Contact" AS c
SET "personId" = u."personId"
FROM "User" AS u
WHERE c."linkedUserId" = u."id"
  AND c."personId" IS NULL;

CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");
CREATE INDEX "Contact_personId_idx" ON "Contact"("personId");
CREATE INDEX "Contact_userId_personId_idx" ON "Contact"("userId", "personId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
