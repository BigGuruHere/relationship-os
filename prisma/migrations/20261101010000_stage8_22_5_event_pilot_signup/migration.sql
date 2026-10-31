-- Stage 8.22.5: isolated and consent-based QR event signup records.
-- IT: Identity and contact data remains encrypted by the server before insertion.
CREATE TABLE "RelishEventPilotSignup" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "nameEnc" TEXT NOT NULL,
  "emailEnc" TEXT,
  "phoneEnc" TEXT,
  "contactKey" VARCHAR(64) NOT NULL,
  "interestGroup" VARCHAR(64) NOT NULL DEFAULT 'TECH_NETWORKING_WALK_2026_11_01',
  "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RelishEventPilotSignup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RelishEventPilotSignup_profileId_contactKey_key"
  ON "RelishEventPilotSignup"("profileId", "contactKey");
CREATE INDEX "RelishEventPilotSignup_ownerUserId_createdAt_idx"
  ON "RelishEventPilotSignup"("ownerUserId", "createdAt");
CREATE INDEX "RelishEventPilotSignup_ownerUserId_interestGroup_createdAt_idx"
  ON "RelishEventPilotSignup"("ownerUserId", "interestGroup", "createdAt");
ALTER TABLE "RelishEventPilotSignup"
  ADD CONSTRAINT "RelishEventPilotSignup_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
