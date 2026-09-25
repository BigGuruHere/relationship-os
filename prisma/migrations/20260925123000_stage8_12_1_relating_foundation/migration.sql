-- Stage 8.12.1: Private Relating histories and unlimited event participants.
-- Additive: old Introduction and Outcome records, participant sides, and review custody remain intact.
-- A Relating record is an owner/context-private container; its existence conveys no mutual consent.

CREATE TABLE "Relating" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "origin" TEXT NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Relating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Relating_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Relating_id_userId_contextSpaceId_key" ON "Relating"("id", "userId", "contextSpaceId");
CREATE INDEX "Relating_userId_contextSpaceId_idx" ON "Relating"("userId", "contextSpaceId");

CREATE TABLE "RelatingParticipant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "relatingId" TEXT NOT NULL,
  "contactId" TEXT,
  "companyId" TEXT,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RelatingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RelatingParticipant_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RelatingParticipant_relatingId_userId_contextSpaceId_fkey" FOREIGN KEY ("relatingId","userId","contextSpaceId") REFERENCES "Relating"("id","userId","contextSpaceId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RelatingParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RelatingParticipant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RelatingParticipant_has_identity_check" CHECK ("contactId" IS NOT NULL OR "companyId" IS NOT NULL),
  CONSTRAINT "RelatingParticipant_left_after_join_check" CHECK ("leftAt" IS NULL OR "leftAt" >= "joinedAt")
);
CREATE UNIQUE INDEX "RelatingParticipant_id_userId_contextSpaceId_key" ON "RelatingParticipant"("id","userId","contextSpaceId");
CREATE INDEX "RelatingParticipant_relatingId_joinedAt_idx" ON "RelatingParticipant"("relatingId","joinedAt");
CREATE INDEX "RelatingParticipant_userId_contextSpaceId_contactId_idx" ON "RelatingParticipant"("userId","contextSpaceId","contactId");
CREATE INDEX "RelatingParticipant_userId_contextSpaceId_companyId_idx" ON "RelatingParticipant"("userId","contextSpaceId","companyId");
-- Do not globally unique Contact or Company within a group: one named person may
-- represent different companies/roles in one legacy Introduction. Service writes
-- reject duplicate *identical* participant identities in one request.

CREATE TABLE "Touchpoint" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "relatingId" TEXT,
  "kind" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notesEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Touchpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Touchpoint_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Touchpoint_relatingId_fkey" FOREIGN KEY ("relatingId") REFERENCES "Relating"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Touchpoint_kind_check" CHECK (length(btrim("kind")) BETWEEN 1 AND 64)
);
CREATE UNIQUE INDEX "Touchpoint_id_userId_contextSpaceId_key" ON "Touchpoint"("id","userId","contextSpaceId");
CREATE INDEX "Touchpoint_relatingId_occurredAt_idx" ON "Touchpoint"("relatingId","occurredAt");
CREATE INDEX "Touchpoint_userId_contextSpaceId_occurredAt_idx" ON "Touchpoint"("userId","contextSpaceId","occurredAt");

CREATE TABLE "TouchpointParticipant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "touchpointId" TEXT NOT NULL,
  "relatingParticipantId" TEXT,
  "contactId" TEXT,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TouchpointParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TouchpointParticipant_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TouchpointParticipant_touchpointId_userId_contextSpaceId_fkey" FOREIGN KEY ("touchpointId","userId","contextSpaceId") REFERENCES "Touchpoint"("id","userId","contextSpaceId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TouchpointParticipant_group_member_fkey" FOREIGN KEY ("relatingParticipantId","userId","contextSpaceId") REFERENCES "RelatingParticipant"("id","userId","contextSpaceId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TouchpointParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TouchpointParticipant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TouchpointParticipant_has_identity_check" CHECK ("relatingParticipantId" IS NOT NULL OR "contactId" IS NOT NULL OR "companyId" IS NOT NULL),
  CONSTRAINT "TouchpointParticipant_membership_or_direct_check" CHECK ("relatingParticipantId" IS NULL OR ("contactId" IS NULL AND "companyId" IS NULL))
);
CREATE UNIQUE INDEX "TouchpointParticipant_touchpointId_relatingParticipantId_key" ON "TouchpointParticipant"("touchpointId","relatingParticipantId");
CREATE INDEX "TouchpointParticipant_userId_contextSpaceId_touchpointId_idx" ON "TouchpointParticipant"("userId","contextSpaceId","touchpointId");
CREATE INDEX "TouchpointParticipant_userId_contextSpaceId_contactId_idx" ON "TouchpointParticipant"("userId","contextSpaceId","contactId");

ALTER TABLE "Introduction" ADD COLUMN "relatingId" TEXT;
CREATE INDEX "Introduction_userId_contextSpaceId_relatingId_idx" ON "Introduction"("userId","contextSpaceId","relatingId");
ALTER TABLE "Introduction" ADD CONSTRAINT "Introduction_relatingId_fkey"
  FOREIGN KEY ("relatingId") REFERENCES "Relating"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Use the existing custody trigger on all new models; unlike the legacy sentinel,
-- null ContextSpace never silently inherits a different user's workspace.
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['Relating','RelatingParticipant','Touchpoint','TouchpointParticipant'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON %I FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"()',table_name||'_context_owner_guard',table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF "userId", "contextSpaceId" ON %I FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"()',table_name||'_context_reassignment_guard',table_name);
  END LOOP;
END $$;

-- Optional links clear when their parent is deleted, but may only be set to a
-- Relating history in the *same* owner and ContextSpace. This is checked in SQL,
-- not by querying across ContextSpaces and filtering after decryption.
CREATE FUNCTION "relish_validate_optional_relating_link"() RETURNS trigger AS $$
BEGIN
  IF NEW."relatingId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Relating" r WHERE r."id"=NEW."relatingId"
      AND r."userId"=NEW."userId" AND r."contextSpaceId"=NEW."contextSpaceId"
  ) THEN RAISE EXCEPTION 'Relating history is outside current custody'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Touchpoint_relating_link_guard" BEFORE INSERT OR UPDATE OF "relatingId","userId","contextSpaceId" ON "Touchpoint" FOR EACH ROW EXECUTE FUNCTION "relish_validate_optional_relating_link"();
CREATE TRIGGER "Introduction_relating_link_guard" BEFORE INSERT OR UPDATE OF "relatingId","userId","contextSpaceId" ON "Introduction" FOR EACH ROW EXECUTE FUNCTION "relish_validate_optional_relating_link"();

-- Fail closed on references to a Contact/Company in a different custody context,
-- and forbid referring to a group member from an unrelated group or a one-off event.
CREATE FUNCTION "relish_validate_relating_participant"() RETURNS trigger AS $$
BEGIN
  IF NEW."contactId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Contact" WHERE "id"=NEW."contactId" AND "userId"=NEW."userId" AND "contextSpaceId"=NEW."contextSpaceId"
  ) THEN RAISE EXCEPTION 'Relating participant Contact is outside current custody'; END IF;
  IF NEW."companyId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Company" WHERE "id"=NEW."companyId" AND "userId"=NEW."userId" AND "contextSpaceId"=NEW."contextSpaceId"
  ) THEN RAISE EXCEPTION 'Relating participant Company is outside current custody'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "RelatingParticipant_entity_guard" BEFORE INSERT OR UPDATE OF "userId","contextSpaceId","contactId","companyId" ON "RelatingParticipant" FOR EACH ROW EXECUTE FUNCTION "relish_validate_relating_participant"();

CREATE FUNCTION "relish_validate_touchpoint_participant"() RETURNS trigger AS $$
DECLARE event_group TEXT;
DECLARE member_group TEXT;
BEGIN
  IF NEW."contactId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Contact" WHERE "id"=NEW."contactId" AND "userId"=NEW."userId" AND "contextSpaceId"=NEW."contextSpaceId"
  ) THEN RAISE EXCEPTION 'Touchpoint Contact is outside current custody'; END IF;
  IF NEW."companyId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Company" WHERE "id"=NEW."companyId" AND "userId"=NEW."userId" AND "contextSpaceId"=NEW."contextSpaceId"
  ) THEN RAISE EXCEPTION 'Touchpoint Company is outside current custody'; END IF;
  IF NEW."relatingParticipantId" IS NOT NULL THEN
    SELECT "relatingId" INTO event_group FROM "Touchpoint" WHERE "id"=NEW."touchpointId" AND "userId"=NEW."userId" AND "contextSpaceId"=NEW."contextSpaceId";
    SELECT "relatingId" INTO member_group FROM "RelatingParticipant" WHERE "id"=NEW."relatingParticipantId" AND "userId"=NEW."userId" AND "contextSpaceId"=NEW."contextSpaceId";
    IF event_group IS NULL OR member_group IS NULL OR event_group <> member_group THEN
      RAISE EXCEPTION 'Touchpoint group membership does not match event';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TouchpointParticipant_entity_guard" BEFORE INSERT OR UPDATE OF "userId","contextSpaceId","touchpointId","relatingParticipantId","contactId","companyId" ON "TouchpointParticipant" FOR EACH ROW EXECUTE FUNCTION "relish_validate_touchpoint_participant"();

-- Relating history is never silently rewritten: move neither event nor membership.
-- A future explicitly audited transfer operation may add a separate link/event model.
CREATE FUNCTION "relish_prevent_relating_group_reassignment"() RETURNS trigger AS $$
BEGIN
  IF NEW."relatingId" IS DISTINCT FROM OLD."relatingId" THEN
    RAISE EXCEPTION 'Relating membership and touchpoint history cannot be reassigned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "RelatingParticipant_group_reassignment_guard" BEFORE UPDATE OF "relatingId" ON "RelatingParticipant" FOR EACH ROW EXECUTE FUNCTION "relish_prevent_relating_group_reassignment"();
-- Directly transferring an existing group event into another group is blocked.
-- The optional link can clear if the history container is deleted; the event
-- itself survives. A future UI will need an audited linking/reclassification flow.
CREATE FUNCTION "relish_protect_touchpoint_group_link"() RETURNS trigger AS $$
BEGIN
  IF OLD."relatingId" IS NOT NULL AND NEW."relatingId" IS NOT NULL
     AND NEW."relatingId" <> OLD."relatingId" THEN
    RAISE EXCEPTION 'Touchpoint cannot move directly between Relating groups';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Touchpoint_group_reassignment_guard" BEFORE UPDATE OF "relatingId" ON "Touchpoint" FOR EACH ROW EXECUTE FUNCTION "relish_protect_touchpoint_group_link"();

-- Historical introduction records each receive a private history container.
-- No touchpoint, mutual relationship, disclosure grant or consent is inferred.
-- Reusing Introduction.id as Relating.id makes the backfill deterministic and retry-friendly.
INSERT INTO "Relating" ("id", "userId", "contextSpaceId", "origin", "createdAt", "updatedAt")
SELECT "id", "userId", "contextSpaceId", 'LEGACY_INTRODUCTION', "createdAt", "updatedAt"
FROM "Introduction";
UPDATE "Introduction" SET "relatingId"="id" WHERE "relatingId" IS NULL;
INSERT INTO "RelatingParticipant" ("id","userId","contextSpaceId","relatingId","contactId","companyId","joinedAt","createdAt")
SELECT p."id",p."userId",p."contextSpaceId",i."relatingId",p."contactId",p."companyId",p."createdAt",p."createdAt"
FROM "IntroductionParticipant" p JOIN "Introduction" i ON i."id"=p."introductionId"
WHERE p."contactId" IS NOT NULL OR p."companyId" IS NOT NULL;
