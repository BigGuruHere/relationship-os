-- Stage 6.4/6.5 enum-only migration.
-- PostgreSQL requires new enum values to be committed before they are safely used by later migrations/application writes.
ALTER TYPE "MarketLeadType" ADD VALUE IF NOT EXISTS 'POTENTIAL_BUYER';
ALTER TYPE "MarketLeadType" ADD VALUE IF NOT EXISTS 'POTENTIAL_SELLER';

ALTER TYPE "MarketLeadStatus" ADD VALUE IF NOT EXISTS 'NOT_CONTACTED';
ALTER TYPE "MarketLeadStatus" ADD VALUE IF NOT EXISTS 'TRIED_NO_CONTACT';
ALTER TYPE "MarketLeadStatus" ADD VALUE IF NOT EXISTS 'LEFT_VOICEMAIL';
ALTER TYPE "MarketLeadStatus" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_NEEDED';
ALTER TYPE "MarketLeadStatus" ADD VALUE IF NOT EXISTS 'CONTACTED';
ALTER TYPE "MarketLeadStatus" ADD VALUE IF NOT EXISTS 'RESPONDED';
ALTER TYPE "MarketLeadStatus" ADD VALUE IF NOT EXISTS 'NURTURE';
