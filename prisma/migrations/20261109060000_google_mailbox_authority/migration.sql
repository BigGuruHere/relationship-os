-- Preserve historic OAuth proofs while distinguishing validated mailbox authority.
BEGIN;
ALTER TABLE "FoundationAccountChannelVerification" DROP CONSTRAINT s405c_proof_shape;
ALTER TABLE "FoundationAccountChannelVerification" ADD CONSTRAINT s405c_proof_shape CHECK (
 generation>0 AND method IN ('SMS_CODE','EMAIL_CODE','GOOGLE_OIDC','GOOGLE_MAILBOX') AND
 (("revokedAt" IS NULL AND "revokeReason" IS NULL) OR ("revokedAt" IS NOT NULL AND "revokeReason" IS NOT NULL AND "revokedAt">="verifiedAt" AND "revokeReason" IN ('OWNER_REVOKED','MAILBOX_RECHECK'))));
CREATE OR REPLACE FUNCTION s405c_proof_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "FoundationAccountChannel"%ROWTYPE; cid text;
BEGIN
 IF TG_TABLE_NAME='FoundationAccountChannel' THEN cid:=COALESCE(NEW.id,OLD.id); ELSE cid:=COALESCE(NEW."channelId",OLD."channelId"); END IF;
 SELECT * INTO c FROM "FoundationAccountChannel" WHERE id=cid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF (c.status='VERIFIED') IS DISTINCT FROM EXISTS(SELECT 1 FROM "FoundationAccountChannelVerification" p WHERE p."channelId"=c.id AND p."ownerUserId"=c."ownerUserId" AND p.generation=c.generation AND p."revokedAt" IS NULL)
 OR EXISTS(SELECT 1 FROM "FoundationAccountChannelVerification" p WHERE p."channelId"=c.id AND p."revokedAt" IS NULL AND (p.generation<>c.generation OR (p.method='SMS_CODE' AND c.type<>'PHONE') OR (p.method IN ('EMAIL_CODE','GOOGLE_OIDC','GOOGLE_MAILBOX') AND c.type<>'EMAIL')))
 THEN RAISE EXCEPTION 'Invalid channel proof state' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
COMMIT;
