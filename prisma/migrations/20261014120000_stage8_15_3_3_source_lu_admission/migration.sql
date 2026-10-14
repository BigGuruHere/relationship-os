-- Stage 8.15.3.3 - preserve legacy LU workflows while letting CRM sources opt out.
-- IT: This does not grant matching or disclosure permissions.
ALTER TABLE "public"."Interaction" ADD COLUMN "luAdmission" TEXT NOT NULL DEFAULT 'ELIGIBLE';
ALTER TABLE "public"."Interaction" ADD CONSTRAINT "Interaction_luAdmission_check" CHECK ("luAdmission" IN ('STORED_ONLY', 'ELIGIBLE', 'WITHDRAWN'));
