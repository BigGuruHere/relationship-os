-- Stage 8.8 - selected lead batch import foundation.
-- Adds stable, context-scoped external company identifiers so a later hot-lead batch
-- can resolve to an existing Company without matching on mutable company names.

CREATE TABLE "CompanyExternalIdentifier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextSpaceId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    "companyId" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "valueIdx" TEXT NOT NULL,
    "sourceUrlEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyExternalIdentifier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyExternalIdentifier_userId_contextSpaceId_scheme_valueIdx_key"
ON "CompanyExternalIdentifier"("userId", "contextSpaceId", "scheme", "valueIdx");
CREATE INDEX "CompanyExternalIdentifier_userId_companyId_idx"
ON "CompanyExternalIdentifier"("userId", "companyId");
CREATE INDEX "CompanyExternalIdentifier_userId_contextSpaceId_idx"
ON "CompanyExternalIdentifier"("userId", "contextSpaceId");
CREATE INDEX "CompanyExternalIdentifier_scheme_valueIdx_idx"
ON "CompanyExternalIdentifier"("scheme", "valueIdx");

ALTER TABLE "CompanyExternalIdentifier"
ADD CONSTRAINT "CompanyExternalIdentifier_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyExternalIdentifier"
ADD CONSTRAINT "CompanyExternalIdentifier_contextSpaceId_fkey"
FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyExternalIdentifier"
ADD CONSTRAINT "CompanyExternalIdentifier_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SECURITY: external identifiers are contextual Workspace knowledge and obey the same
-- owner, custody-reassignment and cross-context-reference rules as their parent Company.
CREATE TRIGGER "CompanyExternalIdentifier_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "CompanyExternalIdentifier"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();

CREATE TRIGGER "CompanyExternalIdentifier_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "CompanyExternalIdentifier"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();

CREATE TRIGGER "CompanyExternalIdentifier_context_reference_guard"
BEFORE INSERT OR UPDATE OF "companyId" ON "CompanyExternalIdentifier"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('companyId', 'Company');
