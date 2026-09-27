-- Stage 8.12.13.2: a complete multi-speaker transcript is a private Dating
-- ContextSpace source, not a statement about one arbitrarily selected person.
-- Preserve the subject requirement on every other Interaction channel.
-- Existing ownership and custody triggers remain unchanged.
BEGIN;
ALTER TABLE "public"."Interaction"
  DROP CONSTRAINT "Interaction_subject_required";
ALTER TABLE "public"."Interaction"
  ADD CONSTRAINT "Interaction_subject_required" CHECK (
    "contactId" IS NOT NULL OR "personId" IS NOT NULL OR "companyId" IS NOT NULL
    OR (
      "channel" = 'DATING_CONVERSATION_TRANSCRIPT'
      AND "sourceType" = 'WORKSPACE'
      AND "externalRef" LIKE 'dating:transcript:%'
    )
  );
COMMIT;
