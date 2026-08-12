-- IT NOTE: create table only if it does not already exist
CREATE TABLE IF NOT EXISTS "public"."OAuthAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email" TEXT,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- IT NOTE: index creation is safe with IF NOT EXISTS
CREATE INDEX IF NOT EXISTS "OAuthAccount_userId_idx"
  ON "public"."OAuthAccount"("userId");

-- IT NOTE: unique index creation is also safe with IF NOT EXISTS
CREATE UNIQUE INDEX IF NOT EXISTS "OAuthAccount_provider_providerAccountId_key"
  ON "public"."OAuthAccount"("provider", "providerAccountId");

-- IT NOTE: Postgres does not support IF NOT EXISTS for constraints directly,
-- so wrap it in a DO block that checks pg_constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'OAuthAccount_userId_fkey'
  ) THEN
    ALTER TABLE "public"."OAuthAccount"
      ADD CONSTRAINT "OAuthAccount_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "public"."User"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;
