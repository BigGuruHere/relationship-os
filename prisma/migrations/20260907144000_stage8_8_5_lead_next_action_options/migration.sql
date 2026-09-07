-- Stage 8.8.5 - reusable Workspace next-action taxonomy for MarketLead workflow.
-- Custom labels are encrypted at rest and equality-deduplicated with a deterministic index.

CREATE TABLE "LeadNextActionOption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextSpaceId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    "labelEnc" TEXT NOT NULL,
    "labelIdx" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadNextActionOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadNextActionOption_user_ctx_label_key"
ON "LeadNextActionOption"("userId", "contextSpaceId", "labelIdx");

CREATE INDEX "LeadNextActionOption_userId_contextSpaceId_updatedAt_idx"
ON "LeadNextActionOption"("userId", "contextSpaceId", "updatedAt");

ALTER TABLE "LeadNextActionOption"
ADD CONSTRAINT "LeadNextActionOption_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadNextActionOption"
ADD CONSTRAINT "LeadNextActionOption_contextSpaceId_fkey"
FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SECURITY: Next-action options are contextual Workspace knowledge and therefore obey the
-- same owner and immutable-custody rules as other direct ContextSpace records.
CREATE TRIGGER "LeadNextActionOption_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "LeadNextActionOption"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();

CREATE TRIGGER "LeadNextActionOption_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "LeadNextActionOption"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
