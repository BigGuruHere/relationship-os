-- A telephone call can wait for voice consent before entering the shared LU queue.
ALTER TYPE "DorianFoundationCallState" ADD VALUE 'AWAITING_TERMS';

ALTER TABLE "DorianFoundationCall"
  ADD COLUMN "phoneChannelId" TEXT,
  ADD COLUMN "phoneChannelGeneration" INTEGER,
  ADD COLUMN "phonePolicyVersion" TEXT;

-- A queued consent notice resolves an account channel again at dispatch time.
ALTER TABLE "RelishPolicySmsDispatch"
  ADD COLUMN "phoneChannelId" TEXT,
  ADD COLUMN "phoneChannelGeneration" INTEGER;
