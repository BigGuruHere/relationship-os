-- Stage 8.13.0 - canonical longitudinal Living Understanding persistence.
-- This migration is the first production migration for persisted Living Understanding.
-- Stages 8.12.14/8.12.15 were development-only and were never deployed to production.

CREATE TABLE "LivingUnderstandingRevision" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "adoptionKey" TEXT NOT NULL,
  "previousRevisionId" TEXT,
  "authorisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivingUnderstandingRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivingUnderstandingTopicIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "nameIdx" TEXT NOT NULL,
  "realmNameEnc" TEXT NOT NULL,
  "topicNameEnc" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivingUnderstandingTopicIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivingUnderstandingTopicVersion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "topicIdentityId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "createdInRevisionId" TEXT NOT NULL,
  "understandingEnc" TEXT NOT NULL,
  "temporalScope" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivingUnderstandingTopicVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivingUnderstandingRevisionTopic" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "topicIdentityId" TEXT NOT NULL,
  "topicVersionId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivingUnderstandingRevisionTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivingUnderstandingRevisionSource" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "sourceInteractionId" TEXT NOT NULL,
  "sourceObservedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivingUnderstandingRevisionSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivingUnderstandingTopicVersionSource" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "topicVersionId" TEXT NOT NULL,
  "sourceInteractionId" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL DEFAULT 'INFORMED',
  "sourceObservedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LivingUnderstandingTopicVersionSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LivingUnderstandingDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "sourceInteractionId" TEXT,
  "baselineRevisionId" TEXT,
  "baselineRevisionNumber" INTEGER,
  "stage" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'WORKING',
  "stateEnc" TEXT NOT NULL,
  "sourceIdsEnc" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "LivingUnderstandingDraft_pkey" PRIMARY KEY ("id")
);

-- Revision identity and linear lineage.
CREATE UNIQUE INDEX "LivingUnderstandingRevision_adoptionKey_key" ON "LivingUnderstandingRevision"("adoptionKey");
CREATE UNIQUE INDEX "LivingUnderstandingRevision_previousRevisionId_key" ON "LivingUnderstandingRevision"("previousRevisionId");
CREATE UNIQUE INDEX "LivingUnderstandingRevision_scope_number" ON "LivingUnderstandingRevision"("userId", "contextSpaceId", "contactId", "revisionNumber");
CREATE UNIQUE INDEX "LivingUnderstandingRevision_id_userId_contextSpaceId_contactId_key" ON "LivingUnderstandingRevision"("id", "userId", "contextSpaceId", "contactId");
CREATE INDEX "LivingUnderstandingRevision_userId_contextSpaceId_contactId_authorisedAt_idx" ON "LivingUnderstandingRevision"("userId", "contextSpaceId", "contactId", "authorisedAt");

-- Topic identity and immutable topic-version sequencing.
CREATE UNIQUE INDEX "LivingUnderstandingTopicIdentity_scope_name" ON "LivingUnderstandingTopicIdentity"("userId", "contextSpaceId", "contactId", "nameIdx");
CREATE UNIQUE INDEX "LivingUnderstandingTopicIdentity_id_userId_contextSpaceId_contactId_key" ON "LivingUnderstandingTopicIdentity"("id", "userId", "contextSpaceId", "contactId");
CREATE INDEX "LivingUnderstandingTopicIdentity_userId_contextSpaceId_contactId_idx" ON "LivingUnderstandingTopicIdentity"("userId", "contextSpaceId", "contactId");
CREATE UNIQUE INDEX "LivingUnderstandingTopicVersion_identity_number" ON "LivingUnderstandingTopicVersion"("topicIdentityId", "versionNumber");
CREATE UNIQUE INDEX "LivingUnderstandingTopicVersion_id_userId_contextSpaceId_contactId_key" ON "LivingUnderstandingTopicVersion"("id", "userId", "contextSpaceId", "contactId");
CREATE UNIQUE INDEX "LivingUnderstandingTopicVersion_identity_scope_key" ON "LivingUnderstandingTopicVersion"("id", "topicIdentityId", "userId", "contextSpaceId", "contactId");
CREATE INDEX "LivingUnderstandingTopicVersion_userId_contextSpaceId_contactId_topicIdentityId_idx" ON "LivingUnderstandingTopicVersion"("userId", "contextSpaceId", "contactId", "topicIdentityId");
CREATE INDEX "LivingUnderstandingTopicVersion_createdInRevisionId_idx" ON "LivingUnderstandingTopicVersion"("createdInRevisionId");

-- A revision snapshot chooses exactly one immutable version per topic identity.
CREATE UNIQUE INDEX "LivingUnderstandingRevisionTopic_revision_identity" ON "LivingUnderstandingRevisionTopic"("revisionId", "topicIdentityId");
CREATE UNIQUE INDEX "LivingUnderstandingRevisionTopic_revision_version" ON "LivingUnderstandingRevisionTopic"("revisionId", "topicVersionId");
CREATE UNIQUE INDEX "LivingUnderstandingRevisionTopic_id_userId_contextSpaceId_contactId_key" ON "LivingUnderstandingRevisionTopic"("id", "userId", "contextSpaceId", "contactId");
CREATE INDEX "LivingUnderstandingRevisionTopic_scope_revision_position_idx" ON "LivingUnderstandingRevisionTopic"("userId", "contextSpaceId", "contactId", "revisionId", "position");

-- Revision-level audit provenance and topic-version-specific evidence provenance.
CREATE UNIQUE INDEX "LivingUnderstandingRevisionSource_unique" ON "LivingUnderstandingRevisionSource"("revisionId", "sourceInteractionId");
CREATE INDEX "LivingUnderstandingRevisionSource_userId_contextSpaceId_contactId_sourceObservedAt_idx" ON "LivingUnderstandingRevisionSource"("userId", "contextSpaceId", "contactId", "sourceObservedAt");
CREATE UNIQUE INDEX "LivingUnderstandingTopicVersionSource_unique" ON "LivingUnderstandingTopicVersionSource"("topicVersionId", "sourceInteractionId");
CREATE INDEX "LivingUnderstandingTopicVersionSource_userId_contextSpaceId_contactId_sourceObservedAt_idx" ON "LivingUnderstandingTopicVersionSource"("userId", "contextSpaceId", "contactId", "sourceObservedAt");

-- Draft checkpoints are explicitly bindable to one source and authoritative baseline.
CREATE UNIQUE INDEX "LivingUnderstandingDraft_id_userId_contextSpaceId_contactId_key" ON "LivingUnderstandingDraft"("id", "userId", "contextSpaceId", "contactId");
CREATE INDEX "LivingUnderstandingDraft_bound_work_idx" ON "LivingUnderstandingDraft"("userId", "contextSpaceId", "contactId", "sourceInteractionId", "updatedAt");
CREATE INDEX "LivingUnderstandingDraft_baselineRevisionId_idx" ON "LivingUnderstandingDraft"("baselineRevisionId");
CREATE INDEX "LivingUnderstandingDraft_expiresAt_idx" ON "LivingUnderstandingDraft"("expiresAt");

ALTER TABLE "LivingUnderstandingRevision" ADD CONSTRAINT "LivingUnderstandingRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevision" ADD CONSTRAINT "LivingUnderstandingRevision_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevision" ADD CONSTRAINT "LivingUnderstandingRevision_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevision" ADD CONSTRAINT "LivingUnderstandingRevision_previousRevisionId_fkey" FOREIGN KEY ("previousRevisionId") REFERENCES "LivingUnderstandingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LivingUnderstandingTopicIdentity" ADD CONSTRAINT "LivingUnderstandingTopicIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingTopicIdentity" ADD CONSTRAINT "LivingUnderstandingTopicIdentity_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingTopicIdentity" ADD CONSTRAINT "LivingUnderstandingTopicIdentity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LivingUnderstandingTopicVersion" ADD CONSTRAINT "LivingUnderstandingTopicVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingTopicVersion" ADD CONSTRAINT "LivingUnderstandingTopicVersion_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingTopicVersion" ADD CONSTRAINT "LivingUnderstandingTopicVersion_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingTopicVersion" ADD CONSTRAINT "LivingUnderstandingTopicVersion_identity_custody_fk" FOREIGN KEY ("topicIdentityId", "userId", "contextSpaceId", "contactId") REFERENCES "LivingUnderstandingTopicIdentity"("id", "userId", "contextSpaceId", "contactId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingTopicVersion" ADD CONSTRAINT "LivingUnderstandingTopicVersion_created_revision_custody_fk" FOREIGN KEY ("createdInRevisionId", "userId", "contextSpaceId", "contactId") REFERENCES "LivingUnderstandingRevision"("id", "userId", "contextSpaceId", "contactId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LivingUnderstandingRevisionTopic" ADD CONSTRAINT "LivingUnderstandingRevisionTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevisionTopic" ADD CONSTRAINT "LivingUnderstandingRevisionTopic_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevisionTopic" ADD CONSTRAINT "LivingUnderstandingRevisionTopic_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevisionTopic" ADD CONSTRAINT "LivingUnderstandingRevisionTopic_revision_custody_fk" FOREIGN KEY ("revisionId", "userId", "contextSpaceId", "contactId") REFERENCES "LivingUnderstandingRevision"("id", "userId", "contextSpaceId", "contactId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevisionTopic" ADD CONSTRAINT "LivingUnderstandingRevisionTopic_identity_custody_fk" FOREIGN KEY ("topicIdentityId", "userId", "contextSpaceId", "contactId") REFERENCES "LivingUnderstandingTopicIdentity"("id", "userId", "contextSpaceId", "contactId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevisionTopic" ADD CONSTRAINT "LivingUnderstandingRevisionTopic_version_custody_fk" FOREIGN KEY ("topicVersionId", "topicIdentityId", "userId", "contextSpaceId", "contactId") REFERENCES "LivingUnderstandingTopicVersion"("id", "topicIdentityId", "userId", "contextSpaceId", "contactId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LivingUnderstandingRevisionSource" ADD CONSTRAINT "LivingUnderstandingRevisionSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevisionSource" ADD CONSTRAINT "LivingUnderstandingRevisionSource_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevisionSource" ADD CONSTRAINT "LivingUnderstandingRevisionSource_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevisionSource" ADD CONSTRAINT "LivingUnderstandingRevisionSource_revision_custody_fk" FOREIGN KEY ("revisionId", "userId", "contextSpaceId", "contactId") REFERENCES "LivingUnderstandingRevision"("id", "userId", "contextSpaceId", "contactId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingRevisionSource" ADD CONSTRAINT "LivingUnderstandingRevisionSource_sourceInteractionId_fkey" FOREIGN KEY ("sourceInteractionId") REFERENCES "Interaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LivingUnderstandingTopicVersionSource" ADD CONSTRAINT "LivingUnderstandingTopicVersionSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingTopicVersionSource" ADD CONSTRAINT "LivingUnderstandingTopicVersionSource_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingTopicVersionSource" ADD CONSTRAINT "LivingUnderstandingTopicVersionSource_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingTopicVersionSource" ADD CONSTRAINT "LivingUnderstandingTopicVersionSource_version_custody_fk" FOREIGN KEY ("topicVersionId", "userId", "contextSpaceId", "contactId") REFERENCES "LivingUnderstandingTopicVersion"("id", "userId", "contextSpaceId", "contactId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingTopicVersionSource" ADD CONSTRAINT "LivingUnderstandingTopicVersionSource_sourceInteractionId_fkey" FOREIGN KEY ("sourceInteractionId") REFERENCES "Interaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LivingUnderstandingDraft" ADD CONSTRAINT "LivingUnderstandingDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingDraft" ADD CONSTRAINT "LivingUnderstandingDraft_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingDraft" ADD CONSTRAINT "LivingUnderstandingDraft_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingDraft" ADD CONSTRAINT "LivingUnderstandingDraft_sourceInteractionId_fkey" FOREIGN KEY ("sourceInteractionId") REFERENCES "Interaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LivingUnderstandingDraft" ADD CONSTRAINT "LivingUnderstandingDraft_baselineRevisionId_fkey" FOREIGN KEY ("baselineRevisionId") REFERENCES "LivingUnderstandingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reuse Stage 8.6 database guards so buggy application or direct SQL writes cannot cross custody boundaries.
CREATE TRIGGER "LivingUnderstandingRevision_context_owner_guard" BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingRevision" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "LivingUnderstandingTopicIdentity_context_owner_guard" BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingTopicIdentity" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "LivingUnderstandingTopicVersion_context_owner_guard" BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingTopicVersion" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "LivingUnderstandingRevisionTopic_context_owner_guard" BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingRevisionTopic" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "LivingUnderstandingRevisionSource_context_owner_guard" BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingRevisionSource" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "LivingUnderstandingTopicVersionSource_context_owner_guard" BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingTopicVersionSource" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "LivingUnderstandingDraft_context_owner_guard" BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingDraft" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();

CREATE TRIGGER "LivingUnderstandingRevision_context_reassignment_guard" BEFORE UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingRevision" FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "LivingUnderstandingTopicIdentity_context_reassignment_guard" BEFORE UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingTopicIdentity" FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "LivingUnderstandingTopicVersion_context_reassignment_guard" BEFORE UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingTopicVersion" FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "LivingUnderstandingRevisionTopic_context_reassignment_guard" BEFORE UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingRevisionTopic" FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "LivingUnderstandingRevisionSource_context_reassignment_guard" BEFORE UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingRevisionSource" FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "LivingUnderstandingTopicVersionSource_context_reassignment_guard" BEFORE UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingTopicVersionSource" FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "LivingUnderstandingDraft_context_reassignment_guard" BEFORE UPDATE OF "userId", "contextSpaceId" ON "LivingUnderstandingDraft" FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();

-- Reference guards validate that every contact, revision, topic/version and source belongs to the same custody scope.
CREATE TRIGGER "LivingUnderstandingRevision_context_reference_guard" BEFORE INSERT OR UPDATE OF "contactId", "previousRevisionId" ON "LivingUnderstandingRevision" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'previousRevisionId', 'LivingUnderstandingRevision');
CREATE TRIGGER "LivingUnderstandingTopicIdentity_context_reference_guard" BEFORE INSERT OR UPDATE OF "contactId" ON "LivingUnderstandingTopicIdentity" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact');
CREATE TRIGGER "LivingUnderstandingTopicVersion_context_reference_guard" BEFORE INSERT OR UPDATE OF "contactId", "topicIdentityId", "createdInRevisionId" ON "LivingUnderstandingTopicVersion" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'topicIdentityId', 'LivingUnderstandingTopicIdentity', 'createdInRevisionId', 'LivingUnderstandingRevision');
CREATE TRIGGER "LivingUnderstandingRevisionTopic_context_reference_guard" BEFORE INSERT OR UPDATE OF "contactId", "revisionId", "topicIdentityId", "topicVersionId" ON "LivingUnderstandingRevisionTopic" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'revisionId', 'LivingUnderstandingRevision', 'topicIdentityId', 'LivingUnderstandingTopicIdentity', 'topicVersionId', 'LivingUnderstandingTopicVersion');
CREATE TRIGGER "LivingUnderstandingRevisionSource_context_reference_guard" BEFORE INSERT OR UPDATE OF "contactId", "revisionId", "sourceInteractionId" ON "LivingUnderstandingRevisionSource" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'revisionId', 'LivingUnderstandingRevision', 'sourceInteractionId', 'Interaction');
CREATE TRIGGER "LivingUnderstandingTopicVersionSource_context_reference_guard" BEFORE INSERT OR UPDATE OF "contactId", "topicVersionId", "sourceInteractionId" ON "LivingUnderstandingTopicVersionSource" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'topicVersionId', 'LivingUnderstandingTopicVersion', 'sourceInteractionId', 'Interaction');
CREATE TRIGGER "LivingUnderstandingDraft_context_reference_guard" BEFORE INSERT OR UPDATE OF "contactId", "sourceInteractionId", "baselineRevisionId" ON "LivingUnderstandingDraft" FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'sourceInteractionId', 'Interaction', 'baselineRevisionId', 'LivingUnderstandingRevision');
