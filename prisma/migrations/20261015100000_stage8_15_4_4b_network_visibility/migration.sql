-- A user may remove a connection from their own Network without changing the other participant's records.
CREATE TABLE "NetworkConnectionVisibility" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otherUserId" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetworkConnectionVisibility_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NetworkConnectionVisibility_userId_otherUserId_key" ON "NetworkConnectionVisibility"("userId", "otherUserId");
CREATE INDEX "NetworkConnectionVisibility_userId_idx" ON "NetworkConnectionVisibility"("userId");
