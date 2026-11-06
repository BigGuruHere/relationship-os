-- S-402a: additive persistence. Application claim writers remain gated.
BEGIN;
-- CreateTable
CREATE TABLE "public"."FoundationExchange" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectKind" "public"."FoundationSubjectKind" NOT NULL DEFAULT 'PERSON',
    "sourceId" TEXT NOT NULL,
    "sourceKind" "public"."FoundationSourceKind" NOT NULL DEFAULT 'CONTACT_EXCHANGE',
    "snapshotEnc" TEXT NOT NULL,
    "destinationEnc" TEXT,
    "continuationHash" TEXT NOT NULL,
    "beneficiaryUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "generation" INTEGER NOT NULL DEFAULT 0,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoundationExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationExchangeChallenge" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destinationEnc" TEXT NOT NULL,
    "codeMac" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FoundationExchangeChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationExchangeDispatch" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "payloadEnc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseToken" TEXT,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoundationExchangeDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoundationExchange_continuationHash_key" ON "public"."FoundationExchange"("continuationHash");

-- CreateIndex
CREATE INDEX "FoundationExchange_ownerUserId_vaultId_status_expiresAt_idx" ON "public"."FoundationExchange"("ownerUserId", "vaultId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationExchange_sourceId_ownerUserId_vaultId_key" ON "public"."FoundationExchange"("sourceId", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationExchange_id_ownerUserId_vaultId_beneficiaryUserId_key" ON "public"."FoundationExchange"("id", "ownerUserId", "vaultId", "beneficiaryUserId");

-- CreateIndex
CREATE INDEX "FoundationExchangeChallenge_beneficiaryUserId_status_expire_idx" ON "public"."FoundationExchangeChallenge"("beneficiaryUserId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationExchangeChallenge_exchangeId_generation_key" ON "public"."FoundationExchangeChallenge"("exchangeId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationExchangeChallenge_id_ownerUserId_vaultId_key" ON "public"."FoundationExchangeChallenge"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationExchangeDispatch_challengeId_key" ON "public"."FoundationExchangeDispatch"("challengeId");

-- CreateIndex
CREATE INDEX "FoundationExchangeDispatch_status_expiresAt_leaseUntil_idx" ON "public"."FoundationExchangeDispatch"("status", "expiresAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationExchangeDispatch_challengeId_ownerUserId_vaultId_key" ON "public"."FoundationExchangeDispatch"("challengeId", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "s402_profile_scope" ON "public"."Profile"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "s402_source_typed" ON "public"."FoundationSource"("id", "ownerUserId", "vaultId", "kind");

-- AddForeignKey
ALTER TABLE "public"."FoundationExchange" ADD CONSTRAINT "FoundationExchange_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationExchange" ADD CONSTRAINT "FoundationExchange_profileId_ownerUserId_fkey" FOREIGN KEY ("profileId", "ownerUserId") REFERENCES "public"."Profile"("id", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationExchange" ADD CONSTRAINT "FoundationExchange_subjectId_ownerUserId_vaultId_subjectKi_fkey" FOREIGN KEY ("subjectId", "ownerUserId", "vaultId", "subjectKind") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationExchange" ADD CONSTRAINT "FoundationExchange_sourceId_ownerUserId_vaultId_sourceKind_fkey" FOREIGN KEY ("sourceId", "ownerUserId", "vaultId", "sourceKind") REFERENCES "public"."FoundationSource"("id", "ownerUserId", "vaultId", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationExchange" ADD CONSTRAINT "FoundationExchange_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationExchangeChallenge" ADD CONSTRAINT "FoundationExchangeChallenge_exchangeId_ownerUserId_vaultId_fkey" FOREIGN KEY ("exchangeId", "ownerUserId", "vaultId", "beneficiaryUserId") REFERENCES "public"."FoundationExchange"("id", "ownerUserId", "vaultId", "beneficiaryUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationExchangeDispatch" ADD CONSTRAINT "FoundationExchangeDispatch_challengeId_ownerUserId_vaultId_fkey" FOREIGN KEY ("challengeId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationExchangeChallenge"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Enforce structural claim state independently of application validation.
ALTER TABLE "FoundationExchange" ADD CONSTRAINT "s402_exchange_valid" CHECK (
  "subjectKind" = 'PERSON' AND "sourceKind" = 'CONTACT_EXCHANGE'
  AND status IN ('PENDING','BOUND','SETTLED','REVOKED','EXPIRED')
  AND (status NOT IN ('BOUND','SETTLED') OR "beneficiaryUserId" IS NOT NULL)
  AND generation >= 0 AND "failedAttempts" BETWEEN 0 AND 5 AND "sendCount" BETWEEN 0 AND 5
  AND "expiresAt" > "createdAt"
  AND "continuationHash" ~ '^[0-9a-f]{64}$'
);
ALTER TABLE "FoundationExchangeChallenge" ADD CONSTRAINT "s402_challenge_valid" CHECK (
  channel IN ('SMS','EMAIL') AND generation > 0 AND attempts BETWEEN 0 AND 5
  AND status IN ('PENDING','VERIFIED','CONSUMED','REVOKED','EXPIRED')
  AND "expiresAt" > "createdAt"
  AND "sessionHash" ~ '^[0-9a-f]{64}$' AND "codeMac" ~ '^[0-9a-f]{64}$'
  AND ("verifiedAt" IS NULL OR ("verifiedAt" >= "createdAt" AND "verifiedAt" < "expiresAt"))
  AND ("consumedAt" IS NULL OR ("verifiedAt" IS NOT NULL AND "consumedAt" >= "verifiedAt" AND "consumedAt" < "expiresAt"))
  AND (status NOT IN ('VERIFIED','CONSUMED') OR "verifiedAt" IS NOT NULL)
  AND (status <> 'CONSUMED' OR "consumedAt" IS NOT NULL)
);
ALTER TABLE "FoundationExchangeDispatch" ADD CONSTRAINT "s402_dispatch_valid" CHECK (
  status IN ('QUEUED','SENDING','FAILED','SENT','EXPIRED','CANCELLED')
  AND attempts >= 0 AND "expiresAt" > "createdAt"
  AND ((status = 'SENDING' AND "leaseUntil" IS NOT NULL AND "leaseToken" IS NOT NULL)
    OR (status <> 'SENDING' AND "leaseUntil" IS NULL AND "leaseToken" IS NULL))
  AND ((status IN ('SENT','EXPIRED','CANCELLED') AND "payloadEnc" IS NULL)
    OR (status IN ('QUEUED','SENDING','FAILED') AND "payloadEnc" IS NOT NULL))
  AND ("lastErrorCode" IS NULL OR "lastErrorCode" ~ '^(DELIVERY_FAILED|DELIVERY_TIMEOUT|DELIVERY_UNAVAILABLE|HTTP_[0-9]{3})$')
);
-- An issued claim retains its owner and exact capture origin; binding is single-assignment.
CREATE FUNCTION "s402_exchange_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW."ownerUserId",NEW."vaultId",NEW."profileId",NEW."subjectId",NEW."sourceId",
         NEW."snapshotEnc",NEW."destinationEnc",NEW."continuationHash",NEW."createdAt",NEW."expiresAt")
     IS DISTINCT FROM
     ROW(OLD.id,OLD."ownerUserId",OLD."vaultId",OLD."profileId",OLD."subjectId",OLD."sourceId",
         OLD."snapshotEnc",OLD."destinationEnc",OLD."continuationHash",OLD."createdAt",OLD."expiresAt")
     OR (OLD."beneficiaryUserId" IS NOT NULL AND NEW."beneficiaryUserId" IS DISTINCT FROM OLD."beneficiaryUserId")
     OR (OLD.status IN ('SETTLED','REVOKED','EXPIRED') AND NEW.status IS DISTINCT FROM OLD.status)
     OR NEW.generation < OLD.generation OR NEW."failedAttempts" < OLD."failedAttempts" OR NEW."sendCount" < OLD."sendCount"
  THEN RAISE EXCEPTION 'Invalid exchange mutation' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "s402_exchange_immutable" BEFORE UPDATE ON "FoundationExchange"
FOR EACH ROW EXECUTE FUNCTION "s402_exchange_immutable"();
-- Each resend creates a fresh challenge generation, preserving prior failed-attempt evidence.
CREATE FUNCTION "s402_challenge_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW."ownerUserId",NEW."vaultId",NEW."exchangeId",NEW."beneficiaryUserId",
         NEW."sessionHash",NEW.channel,NEW."destinationEnc",NEW."codeMac",NEW.generation,NEW."createdAt",NEW."expiresAt")
     IS DISTINCT FROM
     ROW(OLD.id,OLD."ownerUserId",OLD."vaultId",OLD."exchangeId",OLD."beneficiaryUserId",
         OLD."sessionHash",OLD.channel,OLD."destinationEnc",OLD."codeMac",OLD.generation,OLD."createdAt",OLD."expiresAt")
     OR (OLD.status IN ('CONSUMED','REVOKED','EXPIRED') AND NEW.status IS DISTINCT FROM OLD.status)
     OR (OLD.status = 'VERIFIED' AND NEW.status = 'PENDING')
     OR NEW.attempts < OLD.attempts
     OR (OLD."verifiedAt" IS NOT NULL AND NEW."verifiedAt" IS DISTINCT FROM OLD."verifiedAt")
     OR (OLD."consumedAt" IS NOT NULL AND NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt")
  THEN RAISE EXCEPTION 'Invalid challenge mutation' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "s402_challenge_immutable" BEFORE UPDATE ON "FoundationExchangeChallenge"
FOR EACH ROW EXECUTE FUNCTION "s402_challenge_immutable"();

-- Preserve delivery identity and terminal cleanup across worker retries.
CREATE FUNCTION "s402_dispatch_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW."ownerUserId",NEW."vaultId",NEW."challengeId",NEW."createdAt",NEW."expiresAt")
    IS DISTINCT FROM ROW(OLD.id,OLD."ownerUserId",OLD."vaultId",OLD."challengeId",OLD."createdAt",OLD."expiresAt")
    OR NEW.attempts < OLD.attempts
    OR (OLD.status IN ('SENT','EXPIRED','CANCELLED') AND NEW.status IS DISTINCT FROM OLD.status)
 THEN RAISE EXCEPTION 'Invalid delivery mutation' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "s402_dispatch_immutable" BEFORE UPDATE ON "FoundationExchangeDispatch"
FOR EACH ROW EXECUTE FUNCTION "s402_dispatch_immutable"();
COMMIT;
