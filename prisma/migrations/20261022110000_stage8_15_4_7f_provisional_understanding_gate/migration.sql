-- Durable state for a provisional caller's current conversation.
ALTER TABLE "NetworkPhoneCaller"
 ADD COLUMN "understandingState" TEXT NOT NULL DEFAULT 'READY',
 ADD COLUMN "understandingConversationId" TEXT,
 ADD COLUMN "understandingStateAt" TIMESTAMP(3);
