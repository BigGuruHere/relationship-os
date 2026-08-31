-- Stage 8.4.3 - Relationship Intelligence UX support.
-- DATA SAFETY: Existing evidence remains ACTIVE. No relationship data is deleted or rewritten.

ALTER TABLE "public"."KnowledgeEvidence"
  ADD COLUMN "status" "public"."KnowledgeClaimStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "KnowledgeEvidence_userId_claimId_status_idx"
  ON "public"."KnowledgeEvidence"("userId", "claimId", "status");
