-- Stage 8.14.1.1: provider-independent complete conversation transcripts are workspace-owned
-- source records, not statements about one arbitrarily selected person. Permit only the
-- canonical transcript channels to omit an individual subject. All other interactions must
-- continue to identify a Contact, Person or Company.
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
    OR (
      "channel" = 'CONVERSATION_TRANSCRIPT'
      AND "sourceType" IN ('IMPORT', 'API')
      AND "externalRef" LIKE 'conversation:%'
    )
  );

COMMIT;
