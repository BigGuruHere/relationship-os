-- Stage 5.2 duplicate warning follow-up.
-- The prior soft_duplicate_warnings migration attempted to remove the company
-- name uniqueness with ALTER TABLE DROP CONSTRAINT, but the original Prisma
-- migration created it as a unique index. Drop the unique index explicitly so
-- duplicate company names can be handled by the UI warning flow.
DROP INDEX IF EXISTS "public"."Company_userId_nameIdx_key";
CREATE INDEX IF NOT EXISTS "Company_userId_nameIdx_idx" ON "public"."Company"("userId", "nameIdx");
