-- Stage 8.15.4.3: Durable inviter attribution for an authenticated Network connection.
-- Contact rows remain in each owner's existing General ContextSpace.
CREATE TABLE "NetworkConnectionOrigin" (
    "id" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "visitorUserId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "inviterContextSpaceId" TEXT NOT NULL,
    "visitorContextSpaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetworkConnectionOrigin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NetworkConnectionOrigin_inviterUserId_visitorUserId_key" ON "NetworkConnectionOrigin"("inviterUserId", "visitorUserId");
CREATE INDEX "NetworkConnectionOrigin_visitorUserId_idx" ON "NetworkConnectionOrigin"("visitorUserId");
CREATE INDEX "NetworkConnectionOrigin_profileId_idx" ON "NetworkConnectionOrigin"("profileId");
