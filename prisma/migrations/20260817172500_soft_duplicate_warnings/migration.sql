-- Stage 5.2 patch: duplicate names/details become review warnings rather than hard blocks.
-- Companies can share a name when they are legitimately separate records.
ALTER TABLE "public"."Company" DROP CONSTRAINT IF EXISTS "Company_userId_nameIdx_key";
CREATE INDEX IF NOT EXISTS "Company_userId_nameIdx_idx" ON "public"."Company"("userId", "nameIdx");

-- Contact email duplicates are now handled as warnings in the UI rather than a global DB block.
DROP INDEX IF EXISTS "public"."Contact_emailIdx_key";
CREATE INDEX IF NOT EXISTS "Contact_emailIdx_idx" ON "public"."Contact"("emailIdx");
