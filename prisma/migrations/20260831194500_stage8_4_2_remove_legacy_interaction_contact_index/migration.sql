-- Stage 8.4.2 - Remove legacy Interaction contact-only index
-- DATA SAFETY: Index-only cleanup. No rows, columns, tables, constraints, or data are modified.
-- Stage 8.4 replaced @@index([contactId]) with @@index([userId, contactId]) but the 8.4
-- migration did not remove the old Prisma-generated index. Keeping it causes `prisma migrate dev`
-- to detect schema drift and ask for an unnecessary local migration.

DROP INDEX IF EXISTS "public"."Interaction_contactId_idx";
