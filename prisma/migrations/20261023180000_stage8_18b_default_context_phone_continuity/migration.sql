-- Stage 8.18b: optional ContextSpace preference for canonical user/phone participants.
-- Existing accounts are intentionally left NULL: the server resolves and pins their
-- existing phone or first prior SMS callback context after validating ownership.
ALTER TABLE "User" ADD COLUMN "defaultContextSpaceId" TEXT;
CREATE INDEX "User_defaultContextSpaceId_idx" ON "User"("defaultContextSpaceId");
-- Database integrity prevents retaining a preference for a deleted ContextSpace.
-- The application separately verifies that the ContextSpace is owned by the User.
ALTER TABLE "User"
  ADD CONSTRAINT "User_defaultContextSpaceId_fkey"
  FOREIGN KEY ("defaultContextSpaceId") REFERENCES "ContextSpace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
