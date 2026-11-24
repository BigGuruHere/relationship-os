-- A phone-first number is only a Dorian routing hint until a real SMS proof is recorded.
ALTER TABLE "FoundationAccountChannel" ADD COLUMN "dorianPhoneFirst" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FoundationAccountChannel" ADD CONSTRAINT dorian_phone_first_is_phone
  CHECK (NOT "dorianPhoneFirst" OR type = 'PHONE');

-- Unify concurrent first calls without reserving the number against another account's verified claim.
CREATE UNIQUE INDEX dorian_phone_first_pending_number
  ON "FoundationAccountChannel" ("valueHash")
  WHERE "dorianPhoneFirst" AND status = 'PENDING';
