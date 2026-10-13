-- IT: Add independent, revocable privileged capabilities without changing legacy account roles.
CREATE TABLE "UserCapabilityGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedByUserId" TEXT,
  CONSTRAINT "UserCapabilityGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserCapabilityGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserCapabilityGrant_capability_check" CHECK ("capability" IN ('OPERATOR', 'ADMIN', 'BROKER'))
);
CREATE UNIQUE INDEX "UserCapabilityGrant_userId_capability_key" ON "UserCapabilityGrant"("userId", "capability");
CREATE INDEX "UserCapabilityGrant_capability_idx" ON "UserCapabilityGrant"("capability");
