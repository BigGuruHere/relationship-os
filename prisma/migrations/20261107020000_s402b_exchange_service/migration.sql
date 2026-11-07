-- S-402b: service associations, settlement references and opaque rate budgets.
BEGIN;
-- AlterTable
ALTER TABLE "public"."FoundationExchange" ADD COLUMN     "settledSubjectId" TEXT,
ADD COLUMN     "settledVaultId" TEXT;

-- CreateTable
CREATE TABLE "public"."FoundationAccountAssociation" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectKind" "public"."FoundationSubjectKind" NOT NULL DEFAULT 'PERSON',
    "accountId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "channelHash" TEXT NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "exchangeRef" TEXT NOT NULL,

    CONSTRAINT "FoundationAccountAssociation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationClaimBudget" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoundationClaimBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoundationAccountAssociation_channelHash_accountId_idx" ON "public"."FoundationAccountAssociation"("channelHash", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationAccountAssociation_ownerUserId_vaultId_accountId_key" ON "public"."FoundationAccountAssociation"("ownerUserId", "vaultId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationAccountAssociation_ownerUserId_vaultId_subjectId_key" ON "public"."FoundationAccountAssociation"("ownerUserId", "vaultId", "subjectId");

-- CreateIndex
CREATE INDEX "FoundationClaimBudget_expiresAt_idx" ON "public"."FoundationClaimBudget"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."FoundationExchange" ADD CONSTRAINT "FoundationExchange_settledSubjectId_beneficiaryUserId_sett_fkey" FOREIGN KEY ("settledSubjectId", "beneficiaryUserId", "settledVaultId") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationAccountAssociation" ADD CONSTRAINT "FoundationAccountAssociation_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationAccountAssociation" ADD CONSTRAINT "FoundationAccountAssociation_subjectId_ownerUserId_vaultId_fkey" FOREIGN KEY ("subjectId", "ownerUserId", "vaultId", "subjectKind") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationAccountAssociation" ADD CONSTRAINT "FoundationAccountAssociation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


ALTER TABLE "FoundationExchange" ADD CONSTRAINT "s402b_settlement_shape" CHECK (
 ("settledSubjectId" IS NULL AND "settledVaultId" IS NULL AND status <> 'SETTLED')
 OR ("settledSubjectId" IS NOT NULL AND "settledVaultId" IS NOT NULL AND "beneficiaryUserId" IS NOT NULL AND status IN ('SETTLED','REVOKED'))
);
ALTER TABLE "FoundationAccountAssociation" ADD CONSTRAINT "s402b_association_shape" CHECK (
 "subjectKind"='PERSON' AND state IN ('ACTIVE','REVOKED') AND
 ((channel='SMS' AND "channelHash" ~ '^[0-9a-f]{64}$') OR (channel='PROFILE' AND "channelHash"=''))
);
ALTER TABLE "FoundationClaimBudget" ADD CONSTRAINT "s402b_budget_shape" CHECK (count > 0 AND id ~ '^[0-9a-f]{64}$');
CREATE OR REPLACE FUNCTION "s402_exchange_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW."ownerUserId",NEW."vaultId",NEW."profileId",NEW."subjectId",NEW."sourceId",
         NEW."snapshotEnc",NEW."destinationEnc",NEW."continuationHash",NEW."createdAt",NEW."expiresAt")
     IS DISTINCT FROM
     ROW(OLD.id,OLD."ownerUserId",OLD."vaultId",OLD."profileId",OLD."subjectId",OLD."sourceId",
         OLD."snapshotEnc",OLD."destinationEnc",OLD."continuationHash",OLD."createdAt",OLD."expiresAt")
     OR (OLD."beneficiaryUserId" IS NOT NULL AND NEW."beneficiaryUserId" IS DISTINCT FROM OLD."beneficiaryUserId")
     OR (OLD.status IN ('REVOKED','EXPIRED') AND NEW.status IS DISTINCT FROM OLD.status)
     OR (OLD."settledSubjectId" IS NOT NULL AND ROW(NEW."settledSubjectId",NEW."settledVaultId") IS DISTINCT FROM ROW(OLD."settledSubjectId",OLD."settledVaultId"))
     OR (OLD.status = 'SETTLED' AND NEW.status NOT IN ('SETTLED','REVOKED'))
     OR NEW.generation < OLD.generation OR NEW."failedAttempts" < OLD."failedAttempts" OR NEW."sendCount" < OLD."sendCount"
  THEN RAISE EXCEPTION 'Invalid exchange mutation' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
-- Verified identity/provenance is immutable; revocation is monotonic and requires fresh recovery.
CREATE FUNCTION "s402b_association_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW."ownerUserId",NEW."vaultId",NEW."subjectId",NEW."subjectKind",NEW."accountId",NEW.channel,NEW."channelHash",NEW."verifiedAt",NEW."exchangeRef")
  IS DISTINCT FROM ROW(OLD.id,OLD."ownerUserId",OLD."vaultId",OLD."subjectId",OLD."subjectKind",OLD."accountId",OLD.channel,OLD."channelHash",OLD."verifiedAt",OLD."exchangeRef")
  OR (OLD.state='REVOKED' AND NEW.state IS DISTINCT FROM OLD.state)
 THEN RAISE EXCEPTION 'Invalid association mutation' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER s402b_association_immutable BEFORE UPDATE ON "FoundationAccountAssociation"
 FOR EACH ROW EXECUTE FUNCTION "s402b_association_immutable"();
COMMIT;
