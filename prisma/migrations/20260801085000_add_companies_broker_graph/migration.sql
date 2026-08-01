-- IT: Add first-class companies for business broker workflows.
-- IT: Companies can have contacts/employees, be linked to deals, and relate to each other.

ALTER TYPE "DealRelationshipType" ADD VALUE IF NOT EXISTS 'POTENTIAL_BUYER';

CREATE TYPE "CompanyKind" AS ENUM (
  'OPERATING_BUSINESS',
  'STRATEGIC_ACQUIRER',
  'FINANCIAL_BUYER',
  'INVESTOR',
  'BROKERAGE',
  'ADVISORY_FIRM',
  'LAW_FIRM',
  'ACCOUNTING_FIRM',
  'FUNDER',
  'VENDOR_BUSINESS',
  'OTHER'
);

CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'WATCHLIST', 'DO_NOT_CONTACT', 'ARCHIVED');
CREATE TYPE "CompanyContactStatus" AS ENUM ('CURRENT', 'FORMER', 'ADVISOR', 'UNKNOWN');

CREATE TYPE "CompanyRelationshipType" AS ENUM (
  'PARENT_COMPANY',
  'SUBSIDIARY',
  'DIVISION',
  'SISTER_COMPANY',
  'INVESTOR_IN',
  'OWNED_BY',
  'STRATEGIC_PARTNER',
  'REFERRAL_PARTNER',
  'SUPPLIER',
  'CUSTOMER',
  'COMPETITOR',
  'ADVISOR_TO',
  'BROKER_FOR',
  'RELATED_ENTITY',
  'CUSTOM'
);

CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nameEnc" TEXT NOT NULL,
  "nameIdx" TEXT NOT NULL,
  "websiteEnc" TEXT,
  "websiteIdx" TEXT,
  "industryEnc" TEXT,
  "locationEnc" TEXT,
  "descriptionEnc" TEXT,
  "criteriaEnc" TEXT,
  "notesEnc" TEXT,
  "kind" "CompanyKind" NOT NULL DEFAULT 'OPERATING_BUSINESS',
  "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyContact" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "titleEnc" TEXT,
  "departmentEnc" TEXT,
  "notesEnc" TEXT,
  "status" "CompanyContactStatus" NOT NULL DEFAULT 'CURRENT',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealCompany" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "relationshipType" "DealRelationshipType",
  "label" TEXT DEFAULT 'connected',
  "notesEnc" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "stage" "DealContactStage" NOT NULL DEFAULT 'NOT_CONTACTED',
  "interestLevel" "DealContactInterest" NOT NULL DEFAULT 'UNKNOWN',
  "confidentialityStage" "DealConfidentialityStage" NOT NULL DEFAULT 'NONE',
  "nextActionEnc" TEXT,
  "nextFollowUpAt" TIMESTAMP(3),
  "lastContactedAt" TIMESTAMP(3),
  "acquisitionRationaleEnc" TEXT,
  "objectionsEnc" TEXT,
  "fundingCapacityEnc" TEXT,
  "referralPathEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealCompany_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyRelationship" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyAId" TEXT NOT NULL,
  "companyBId" TEXT NOT NULL,
  "relationshipType" "CompanyRelationshipType",
  "label" TEXT DEFAULT 'related',
  "notesEnc" TEXT,
  "isDirectional" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyRelationship_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "dealCompanyId" TEXT;

CREATE UNIQUE INDEX "Company_userId_nameIdx_key" ON "Company"("userId", "nameIdx");
CREATE INDEX "Company_userId_kind_idx" ON "Company"("userId", "kind");
CREATE INDEX "Company_userId_status_idx" ON "Company"("userId", "status");
CREATE INDEX "Company_nameIdx_idx" ON "Company"("nameIdx");
CREATE INDEX "Company_websiteIdx_idx" ON "Company"("websiteIdx");

CREATE UNIQUE INDEX "CompanyContact_companyId_contactId_key" ON "CompanyContact"("companyId", "contactId");
CREATE INDEX "CompanyContact_userId_companyId_idx" ON "CompanyContact"("userId", "companyId");
CREATE INDEX "CompanyContact_userId_contactId_idx" ON "CompanyContact"("userId", "contactId");
CREATE INDEX "CompanyContact_userId_status_idx" ON "CompanyContact"("userId", "status");

CREATE UNIQUE INDEX "DealCompany_dealId_companyId_label_key" ON "DealCompany"("dealId", "companyId", "label");
CREATE INDEX "DealCompany_userId_dealId_idx" ON "DealCompany"("userId", "dealId");
CREATE INDEX "DealCompany_userId_companyId_idx" ON "DealCompany"("userId", "companyId");
CREATE INDEX "DealCompany_userId_relationshipType_idx" ON "DealCompany"("userId", "relationshipType");
CREATE INDEX "DealCompany_userId_stage_idx" ON "DealCompany"("userId", "stage");
CREATE INDEX "DealCompany_userId_interestLevel_idx" ON "DealCompany"("userId", "interestLevel");
CREATE INDEX "DealCompany_userId_nextFollowUpAt_idx" ON "DealCompany"("userId", "nextFollowUpAt");

CREATE UNIQUE INDEX "CompanyRelationship_userId_companyAId_companyBId_relationshipType_label_key" ON "CompanyRelationship"("userId", "companyAId", "companyBId", "relationshipType", "label");
CREATE INDEX "CompanyRelationship_userId_companyAId_idx" ON "CompanyRelationship"("userId", "companyAId");
CREATE INDEX "CompanyRelationship_userId_companyBId_idx" ON "CompanyRelationship"("userId", "companyBId");
CREATE INDEX "CompanyRelationship_userId_relationshipType_idx" ON "CompanyRelationship"("userId", "relationshipType");

CREATE INDEX "Task_userId_companyId_idx" ON "Task"("userId", "companyId");
CREATE INDEX "Task_userId_dealCompanyId_idx" ON "Task"("userId", "dealCompanyId");

ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealCompany" ADD CONSTRAINT "DealCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealCompany" ADD CONSTRAINT "DealCompany_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealCompany" ADD CONSTRAINT "DealCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyRelationship" ADD CONSTRAINT "CompanyRelationship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyRelationship" ADD CONSTRAINT "CompanyRelationship_companyAId_fkey" FOREIGN KEY ("companyAId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyRelationship" ADD CONSTRAINT "CompanyRelationship_companyBId_fkey" FOREIGN KEY ("companyBId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealCompanyId_fkey" FOREIGN KEY ("dealCompanyId") REFERENCES "DealCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
