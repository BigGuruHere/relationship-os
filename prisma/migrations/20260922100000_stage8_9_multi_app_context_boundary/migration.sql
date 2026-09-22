-- Stage 8.9: add application-domain identity, agent deployment boundaries, and sensitive audit classification.
-- IT: This migration is additive and keeps every existing contextual record in its current default Business ContextSpace.

ALTER TABLE "ContextSpace"
  ADD COLUMN "domainKey" TEXT NOT NULL DEFAULT 'business',
  ADD COLUMN "displayNameEnc" TEXT;

-- IT: Existing spaces and all existing contextual records remain in place. Only their application-domain identity is made explicit.
UPDATE "ContextSpace" SET "domainKey" = 'business' WHERE "domainKey" IS NULL OR btrim("domainKey") = '';

ALTER TABLE "ContextSpace"
  ADD CONSTRAINT "ContextSpace_domainKey_format_check"
  CHECK ("domainKey" ~ '^[a-z][a-z0-9_-]{0,63}$');

CREATE INDEX "ContextSpace_ownerUserId_domainKey_idx" ON "ContextSpace"("ownerUserId", "domainKey");

ALTER TABLE "AgentDefinition"
  ADD COLUMN "allowedDomainKeys" TEXT[] NOT NULL DEFAULT ARRAY['business']::TEXT[],
  ADD COLUMN "allowedContextSpaceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "AgentRun"
  ADD COLUMN "auditDataClass" TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE "AgentRun"
  ADD CONSTRAINT "AgentRun_auditDataClass_check"
  CHECK ("auditDataClass" IN ('standard', 'sensitive'));

CREATE INDEX "AgentRun_userId_auditDataClass_idx" ON "AgentRun"("userId", "auditDataClass");

-- IT: New users continue to receive a deterministic default ContextSpace, now explicitly in the Business domain.
CREATE OR REPLACE FUNCTION "relish_create_default_context_for_user"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "ContextSpace" ("id", "ownerUserId", "kind", "domainKey", "isDefault", "createdAt", "updatedAt")
  VALUES (NEW."id", NEW."id", 'WORKSPACE'::"ContextSpaceKind", 'business', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
