-- S-405d: preserve v1 claims while binding exact channels for new account-assurance claims.
BEGIN;
-- AlterTable
ALTER TABLE "public"."FoundationExchange" ADD COLUMN     "claimVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "submittedChannelsEnc" TEXT;


ALTER TABLE "FoundationExchange" ADD CONSTRAINT s405d_version_shape CHECK (("claimVersion"=1 AND "submittedChannelsEnc" IS NULL) OR ("claimVersion"=2 AND "submittedChannelsEnc" IS NOT NULL AND "destinationEnc" IS NULL));
ALTER TABLE "FoundationAccountAssociation" DROP CONSTRAINT s402b_association_shape;
ALTER TABLE "FoundationAccountAssociation" ADD CONSTRAINT s402b_association_shape CHECK (
 "subjectKind"='PERSON' AND state IN ('ACTIVE','REVOKED') AND
 ((channel IN ('SMS','ACCOUNT_CHANNEL') AND "channelHash" ~ '^[0-9a-f]{64}$') OR (channel='PROFILE' AND "channelHash"='')));
CREATE FUNCTION s405d_claim_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF ROW(NEW."claimVersion",NEW."submittedChannelsEnc") IS DISTINCT FROM ROW(OLD."claimVersion",OLD."submittedChannelsEnc") THEN RAISE EXCEPTION 'Immutable claim version' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER s405d_claim_immutable BEFORE UPDATE ON "FoundationExchange" FOR EACH ROW EXECUTE FUNCTION s405d_claim_immutable();
COMMIT;
