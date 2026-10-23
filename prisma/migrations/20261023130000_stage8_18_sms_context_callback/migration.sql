-- Stage 8.18: server-issued, single-use QR/SMS invitation and context preferences.
CREATE TABLE "PilotSmsInvitation" (
  "id" TEXT NOT NULL,
  "codeHash" VARCHAR(64) NOT NULL,
  "profileId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "domainKey" TEXT NOT NULL,
  "environment" VARCHAR(12) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'link',
  "termsVersion" VARCHAR(60) NOT NULL,
  "offeredNameEnc" TEXT,
  "offeredEmailEnc" TEXT,
  "connectionConsentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "telnyxMessageId" TEXT,
  "phoneIndex" VARCHAR(64),
  "participantUserId" TEXT,
  "pilotEntryId" TEXT,
  "conversationId" TEXT,
  "callAttemptedAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(60),
  CONSTRAINT "PilotSmsInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PilotSmsInvitation_codeHash_key" ON "PilotSmsInvitation"("codeHash");
CREATE UNIQUE INDEX "PilotSmsInvitation_telnyxMessageId_key" ON "PilotSmsInvitation"("telnyxMessageId");
CREATE UNIQUE INDEX "PilotSmsInvitation_conversationId_key" ON "PilotSmsInvitation"("conversationId");
CREATE INDEX "PilotSmsInvitation_ownerUserId_createdAt_idx" ON "PilotSmsInvitation"("ownerUserId", "createdAt");
CREATE INDEX "PilotSmsInvitation_phoneIndex_createdAt_idx" ON "PilotSmsInvitation"("phoneIndex", "createdAt");
CREATE INDEX "PilotSmsInvitation_status_expiresAt_idx" ON "PilotSmsInvitation"("status", "expiresAt");

CREATE TABLE "RelishContextPreference" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "domainKey" TEXT NOT NULL,
  "connectionMode" TEXT NOT NULL DEFAULT 'AUTOMATIC',
  "dorianMode" TEXT NOT NULL DEFAULT 'SMS_CALLBACK',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RelishContextPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RelishContextPreference_ownerUserId_domainKey_key" ON "RelishContextPreference"("ownerUserId", "domainKey");

CREATE TABLE "PilotSmsOptOut" (
  "phoneIndex" VARCHAR(64) NOT NULL,
  "optedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resumedAt" TIMESTAMP(3),
  CONSTRAINT "PilotSmsOptOut_pkey" PRIMARY KEY ("phoneIndex")
);
