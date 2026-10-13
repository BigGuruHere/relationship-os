-- Stage 8.14.5: review queue disposition for conversation sources.
-- Dismissal is workflow metadata only: source Interactions and authorised LU remain immutable.
BEGIN;

CREATE TABLE "public"."LivingUnderstandingSourceReviewDisposition" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "sourceInteractionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "dismissedAt" TIMESTAMP(3),
  "restoredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivingUnderstandingSourceReviewDisposition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LivingUnderstandingSourceReviewDisposition_status_check" CHECK ("status" IN ('ACTIVE', 'DISMISSED'))
);

CREATE UNIQUE INDEX "LivingUnderstandingSourceReviewDisposition_scope_source"
  ON "public"."LivingUnderstandingSourceReviewDisposition"("userId", "contextSpaceId", "contactId", "sourceInteractionId");
CREATE INDEX "LivingUnderstandingSourceReviewDisposition_queue_idx"
  ON "public"."LivingUnderstandingSourceReviewDisposition"("userId", "contextSpaceId", "status", "updatedAt");
CREATE INDEX "LivingUnderstandingSourceReviewDisposition_contact_idx"
  ON "public"."LivingUnderstandingSourceReviewDisposition"("userId", "contextSpaceId", "contactId", "updatedAt");

ALTER TABLE "public"."LivingUnderstandingSourceReviewDisposition"
  ADD CONSTRAINT "LivingUnderstandingSourceReviewDisposition_user_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LivingUnderstandingSourceReviewDisposition_context_fk" FOREIGN KEY ("contextSpaceId") REFERENCES "public"."ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LivingUnderstandingSourceReviewDisposition_contact_fk" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LivingUnderstandingSourceReviewDisposition_source_fk" FOREIGN KEY ("sourceInteractionId") REFERENCES "public"."Interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
