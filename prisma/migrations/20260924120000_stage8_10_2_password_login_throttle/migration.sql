-- Stage 8.10.2: shared atomic login attempt budgets.
-- Only purpose-separated HMAC keys are stored. No plaintext addresses or emails.
CREATE TABLE "PasswordLoginThrottle" (
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PasswordLoginThrottle_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "PasswordLoginThrottle_expiresAt_idx" ON "PasswordLoginThrottle"("expiresAt");
