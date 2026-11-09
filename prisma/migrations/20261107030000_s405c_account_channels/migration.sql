-- S-405c: additive account-owned assurance, no backfill or enrollment.
BEGIN;
-- CreateTable
CREATE TABLE "public"."FoundationAccountChannel" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "normalizationVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "generation" INTEGER NOT NULL DEFAULT 0,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "windowAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoundationAccountChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationAccountChannelVerification" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "proofRef" TEXT NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "revokeReason" TEXT,

    CONSTRAINT "FoundationAccountChannelVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationAccountChannelChallenge" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "codeMac" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'VERIFY_CHANNEL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FoundationAccountChannelChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationAccountChannelDispatch" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "payloadEnc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoundationAccountChannelDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoundationAccountChannel_id_ownerUserId_key" ON "public"."FoundationAccountChannel"("id", "ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationAccountChannel_ownerUserId_type_valueHash_key" ON "public"."FoundationAccountChannel"("ownerUserId", "type", "valueHash");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationAccountChannelVerification_channelId_generation_key" ON "public"."FoundationAccountChannelVerification"("channelId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationAccountChannelChallenge_id_ownerUserId_key" ON "public"."FoundationAccountChannelChallenge"("id", "ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationAccountChannelChallenge_channelId_generation_key" ON "public"."FoundationAccountChannelChallenge"("channelId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationAccountChannelDispatch_challengeId_key" ON "public"."FoundationAccountChannelDispatch"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationAccountChannelDispatch_challengeId_ownerUserId_key" ON "public"."FoundationAccountChannelDispatch"("challengeId", "ownerUserId");

-- AddForeignKey
ALTER TABLE "public"."FoundationAccountChannel" ADD CONSTRAINT "FoundationAccountChannel_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationAccountChannelVerification" ADD CONSTRAINT "FoundationAccountChannelVerification_channelId_ownerUserId_fkey" FOREIGN KEY ("channelId", "ownerUserId") REFERENCES "public"."FoundationAccountChannel"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationAccountChannelChallenge" ADD CONSTRAINT "FoundationAccountChannelChallenge_channelId_ownerUserId_fkey" FOREIGN KEY ("channelId", "ownerUserId") REFERENCES "public"."FoundationAccountChannel"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationAccountChannelDispatch" ADD CONSTRAINT "FoundationAccountChannelDispatch_challengeId_ownerUserId_fkey" FOREIGN KEY ("challengeId", "ownerUserId") REFERENCES "public"."FoundationAccountChannelChallenge"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- A pending channel never reserves another person's channel; verified claims are exclusive.
CREATE UNIQUE INDEX s405c_verified_channel ON "FoundationAccountChannel" (type,"valueHash") WHERE status='VERIFIED';
ALTER TABLE "FoundationAccountChannel" ADD CONSTRAINT s405c_channel_shape CHECK (
 type IN ('PHONE','EMAIL') AND status IN ('PENDING','VERIFIED','REVOKED') AND "normalizationVersion"=1
 AND "valueHash" ~ '^[0-9a-f]{64}$' AND generation>=0 AND "failedAttempts" BETWEEN 0 AND 5 AND "sendCount" BETWEEN 0 AND 5);
ALTER TABLE "FoundationAccountChannelVerification" ADD CONSTRAINT s405c_proof_shape CHECK (
 generation>0 AND method IN ('SMS_CODE','EMAIL_CODE','GOOGLE_OIDC') AND
 (("revokedAt" IS NULL AND "revokeReason" IS NULL) OR ("revokedAt" IS NOT NULL AND "revokeReason" IS NOT NULL AND "revokedAt">="verifiedAt" AND "revokeReason"='OWNER_REVOKED')));
ALTER TABLE "FoundationAccountChannelChallenge" ADD CONSTRAINT s405c_challenge_shape CHECK (
 generation>0 AND purpose='VERIFY_CHANNEL' AND "sessionHash" ~ '^[0-9a-f]{64}$' AND "codeMac" ~ '^[0-9a-f]{64}$'
 AND status IN ('PENDING','CONSUMED','REVOKED','EXPIRED') AND attempts BETWEEN 0 AND 5 AND "expiresAt">"createdAt"
 AND ((status='CONSUMED' AND "consumedAt" IS NOT NULL AND "consumedAt">="createdAt" AND "consumedAt"<"expiresAt") OR (status<>'CONSUMED' AND "consumedAt" IS NULL)));
ALTER TABLE "FoundationAccountChannelDispatch" ADD CONSTRAINT s405c_dispatch_shape CHECK (
 status IN ('QUEUED','FAILED','SENT','EXPIRED','CANCELLED') AND attempts BETWEEN 0 AND 3 AND "expiresAt">"createdAt"
 AND ((status IN ('QUEUED','FAILED') AND "payloadEnc" IS NOT NULL) OR (status IN ('SENT','EXPIRED','CANCELLED') AND "payloadEnc" IS NULL)));
-- Identity and proof bindings cannot be reassigned or rewritten during retries.
CREATE FUNCTION s405c_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed text[];
BEGIN
 IF TG_TABLE_NAME='FoundationAccountChannel' THEN
  allowed:=ARRAY['status','generation','failedAttempts','sendCount','windowAt','updatedAt'];
  IF NEW.generation<OLD.generation OR NEW."windowAt"<OLD."windowAt" OR
   ((NEW."failedAttempts"<OLD."failedAttempts" OR NEW."sendCount"<OLD."sendCount") AND NEW."windowAt"<OLD."windowAt"+interval '1 hour')
  THEN RAISE EXCEPTION 'Invalid channel mutation' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='FoundationAccountChannelVerification' THEN
  allowed:=ARRAY['revokedAt','revokeReason'];
  IF OLD."revokedAt" IS NOT NULL AND ROW(NEW."revokedAt",NEW."revokeReason") IS DISTINCT FROM ROW(OLD."revokedAt",OLD."revokeReason")
  THEN RAISE EXCEPTION 'Invalid proof mutation' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='FoundationAccountChannelChallenge' THEN
  allowed:=ARRAY['status','attempts','consumedAt'];
  IF NEW.attempts<OLD.attempts OR (OLD.status<>'PENDING' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD))
  THEN RAISE EXCEPTION 'Invalid challenge mutation' USING ERRCODE='23514'; END IF;
 ELSE
  allowed:=ARRAY['status','attempts','payloadEnc'];
  IF NEW.attempts<OLD.attempts OR (OLD.status IN ('SENT','EXPIRED','CANCELLED') AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD))
  THEN RAISE EXCEPTION 'Invalid dispatch mutation' USING ERRCODE='23514'; END IF;
 END IF;
 IF (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN
  RAISE EXCEPTION 'Immutable account binding' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER s405c_channel_immutable BEFORE UPDATE ON "FoundationAccountChannel" FOR EACH ROW EXECUTE FUNCTION s405c_immutable();
CREATE TRIGGER s405c_proof_immutable BEFORE UPDATE ON "FoundationAccountChannelVerification" FOR EACH ROW EXECUTE FUNCTION s405c_immutable();
CREATE TRIGGER s405c_challenge_immutable BEFORE UPDATE ON "FoundationAccountChannelChallenge" FOR EACH ROW EXECUTE FUNCTION s405c_immutable();
CREATE TRIGGER s405c_dispatch_immutable BEFORE UPDATE ON "FoundationAccountChannelDispatch" FOR EACH ROW EXECUTE FUNCTION s405c_immutable();
-- Verified status must have current unrevoked proof, and every live proof must match its channel.
CREATE FUNCTION s405c_proof_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "FoundationAccountChannel"%ROWTYPE; cid text;
BEGIN
 IF TG_TABLE_NAME='FoundationAccountChannel' THEN cid:=COALESCE(NEW.id,OLD.id); ELSE cid:=COALESCE(NEW."channelId",OLD."channelId"); END IF;
 SELECT * INTO c FROM "FoundationAccountChannel" WHERE id=cid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF (c.status='VERIFIED') IS DISTINCT FROM EXISTS(SELECT 1 FROM "FoundationAccountChannelVerification" p WHERE p."channelId"=c.id AND p."ownerUserId"=c."ownerUserId" AND p.generation=c.generation AND p."revokedAt" IS NULL)
 OR EXISTS(SELECT 1 FROM "FoundationAccountChannelVerification" p WHERE p."channelId"=c.id AND p."revokedAt" IS NULL AND (p.generation<>c.generation OR (p.method='SMS_CODE' AND c.type<>'PHONE') OR (p.method IN ('EMAIL_CODE','GOOGLE_OIDC') AND c.type<>'EMAIL')))
 THEN RAISE EXCEPTION 'Invalid channel proof state' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER s405c_channel_proof AFTER INSERT OR UPDATE ON "FoundationAccountChannel" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION s405c_proof_consistency();
CREATE CONSTRAINT TRIGGER s405c_proof_channel AFTER INSERT OR UPDATE OR DELETE ON "FoundationAccountChannelVerification" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION s405c_proof_consistency();
COMMIT;
