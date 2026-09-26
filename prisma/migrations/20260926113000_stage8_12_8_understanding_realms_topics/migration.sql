-- Stage 8.12.8 - Additive person-local Realms and Topics. Never infer consent from organisation.
-- Labels are encrypted by the application; DB-only guards protect every cross-record custody edge.
CREATE TABLE "UnderstandingRealm" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL, "key" TEXT NOT NULL, "nameEnc" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnderstandingRealm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnderstandingRealm_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnderstandingRealm_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UnderstandingRealm_userId_contextSpaceId_contactId_key_key" ON "UnderstandingRealm"("userId","contextSpaceId","contactId","key");
CREATE UNIQUE INDEX "UnderstandingRealm_id_userId_contextSpaceId_contactId_key" ON "UnderstandingRealm"("id","userId","contextSpaceId","contactId");
CREATE INDEX "UnderstandingRealm_userId_contextSpaceId_contactId_idx" ON "UnderstandingRealm"("userId","contextSpaceId","contactId");

CREATE TABLE "UnderstandingTopic" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL, "realmId" TEXT NOT NULL, "nameEnc" TEXT NOT NULL,
  "nameIdx" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnderstandingTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnderstandingTopic_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnderstandingTopic_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnderstandingTopic_realmId_userId_contextSpaceId_contactId_fkey" FOREIGN KEY ("realmId","userId","contextSpaceId","contactId") REFERENCES "UnderstandingRealm"("id","userId","contextSpaceId","contactId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UnderstandingTopic_unique_name" ON "UnderstandingTopic"("userId","contextSpaceId","contactId","realmId","nameIdx");
CREATE UNIQUE INDEX "UnderstandingTopic_id_userId_contextSpaceId_contactId_key" ON "UnderstandingTopic"("id","userId","contextSpaceId","contactId");
CREATE INDEX "UnderstandingTopic_userId_contextSpaceId_contactId_realmId_idx" ON "UnderstandingTopic"("userId","contextSpaceId","contactId","realmId");

CREATE TABLE "UnderstandingTopicClaim" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "contextSpaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL, "topicId" TEXT NOT NULL, "claimId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnderstandingTopicClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnderstandingTopicClaim_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnderstandingTopicClaim_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnderstandingTopicClaim_topic_custody_fk" FOREIGN KEY ("topicId","userId","contextSpaceId","contactId") REFERENCES "UnderstandingTopic"("id","userId","contextSpaceId","contactId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnderstandingTopicClaim_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "KnowledgeClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UnderstandingTopicClaim_unique_link" ON "UnderstandingTopicClaim"("userId","contextSpaceId","contactId","topicId","claimId");
CREATE INDEX "UnderstandingTopicClaim_claim_idx" ON "UnderstandingTopicClaim"("userId","contextSpaceId","contactId","claimId");

-- Owner and immutable-custody guards already defined in Stage 8.6.
DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['UnderstandingRealm','UnderstandingTopic','UnderstandingTopicClaim'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON %I FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"()', table_name||'_context_owner_guard', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF "userId", "contextSpaceId" ON %I FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"()', table_name||'_context_reassignment_guard', table_name);
  END LOOP;
END $$;
-- Composite FKs protect topic->realm and link->topic. The generic trigger also checks
-- the contact and claim edges, which otherwise have single-column foreign keys.
CREATE TRIGGER "UnderstandingRealm_context_reference_guard"
BEFORE INSERT OR UPDATE ON "UnderstandingRealm"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact');
CREATE TRIGGER "UnderstandingTopic_context_reference_guard"
BEFORE INSERT OR UPDATE ON "UnderstandingTopic"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'realmId', 'UnderstandingRealm');
CREATE TRIGGER "UnderstandingTopicClaim_context_reference_guard"
BEFORE INSERT OR UPDATE ON "UnderstandingTopicClaim"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'topicId', 'UnderstandingTopic', 'claimId', 'KnowledgeClaim');
-- Extra same-person guard: a claim in another person's record cannot be linked even
-- when it belongs to the same owner/ContextSpace.
CREATE FUNCTION "relish_validate_understanding_claim_subject"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "KnowledgeClaim" k WHERE k."id" = NEW."claimId"
    AND k."userId" = NEW."userId" AND k."contextSpaceId" = NEW."contextSpaceId"
    AND k."contactId" = NEW."contactId") THEN
    RAISE EXCEPTION 'Understanding topic knowledge claim belongs to another person or custody';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "UnderstandingTopicClaim_person_guard"
BEFORE INSERT OR UPDATE OF "claimId", "contactId", "userId", "contextSpaceId" ON "UnderstandingTopicClaim"
FOR EACH ROW EXECUTE FUNCTION "relish_validate_understanding_claim_subject"();
