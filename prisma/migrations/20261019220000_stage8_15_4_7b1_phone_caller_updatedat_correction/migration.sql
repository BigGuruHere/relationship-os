-- Align the phone caller updatedAt column with Prisma @updatedAt (no database default).
-- This is safe to apply after the 8.15.4.7b migration, including databases
-- where the default was already dropped manually.
ALTER TABLE "NetworkPhoneCaller" ALTER COLUMN "updatedAt" DROP DEFAULT;
