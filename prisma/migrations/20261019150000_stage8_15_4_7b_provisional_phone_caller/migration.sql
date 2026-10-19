-- A deterministic HMAC key identifies a provisional phone caller without plaintext phone storage.
-- Relish User, Person, ContextSpace, Contact and NetworkDorianSession remain canonical for custody.
CREATE TABLE "NetworkPhoneCaller" (
 "id" TEXT NOT NULL,
 "phoneIndex" VARCHAR(64) NOT NULL,
 "phoneEnc" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "contextSpaceId" TEXT NOT NULL,
 "contactId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "NetworkPhoneCaller_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NetworkPhoneCaller_phoneIndex_key" ON "NetworkPhoneCaller"("phoneIndex");
CREATE UNIQUE INDEX "NetworkPhoneCaller_userId_key" ON "NetworkPhoneCaller"("userId");
CREATE UNIQUE INDEX "NetworkPhoneCaller_contextSpaceId_key" ON "NetworkPhoneCaller"("contextSpaceId");
CREATE UNIQUE INDEX "NetworkPhoneCaller_contactId_key" ON "NetworkPhoneCaller"("contactId");
CREATE INDEX "NetworkPhoneCaller_createdAt_idx" ON "NetworkPhoneCaller"("createdAt");
