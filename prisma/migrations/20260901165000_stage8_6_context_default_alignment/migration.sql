-- Stage 8.6 follow-up: align Prisma's static sentinel representation with the database.
-- The main 8.6 migration is already applied in development and must not be edited in place.
-- These statements are safe on fresh databases as well as the already-migrated development database.

-- Prisma @updatedAt manages this field at the ORM layer, so no database default is required.
ALTER TABLE "ContextSpace" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Restore the three live database sentinel defaults that Prisma's direct datasource diff reported missing.
-- The custody trigger rejects this sentinel, so it remains a fail-closed tripwire rather than a fallback.
ALTER TABLE "Task" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Want" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "WantNote" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
