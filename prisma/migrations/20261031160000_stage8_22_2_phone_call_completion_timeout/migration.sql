-- Stage 8.22.2: persist the provider-confirmed call completion time.
ALTER TABLE "NetworkPhoneCaller" ADD COLUMN "understandingCallEndedAt" TIMESTAMP(3);
