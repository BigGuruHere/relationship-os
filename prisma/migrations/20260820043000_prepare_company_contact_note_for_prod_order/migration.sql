-- Production order fix for Stage 6.9.
--
-- A local sync migration named 20260820044823_sync_company_contact_note_updated_at
-- can sort before the main Stage 6.9 migration that creates CompanyContactNote.
-- This idempotent migration creates the table shell first so that the older sync
-- migration can safely run in production. The main Stage 6.9 migration later adds
-- the foreign keys, indexes, and relationship columns.

CREATE TABLE IF NOT EXISTS "CompanyContactNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyContactId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" TEXT NOT NULL DEFAULT 'note',
  "bodyEnc" TEXT NOT NULL,
  "summaryEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyContactNote_pkey" PRIMARY KEY ("id")
);
