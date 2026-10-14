-- Stage 8.15.3.5: govern understanding subjects separately from existing LU versions.
-- No existing LU, Contact, Relating or source data is migrated or reclassified.
CREATE TYPE "public"."GovernedUnderstandingSubjectKind" AS ENUM ('SELF', 'PERSON_VIEW', 'RELATIONSHIP_VIEW');

CREATE TABLE "public"."GovernedUnderstandingScope" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "contextSpaceId" TEXT NOT NULL,
 "kind" "public"."GovernedUnderstandingSubjectKind" NOT NULL,
 "contactId" TEXT,
 "relatingId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "GovernedUnderstandingScope_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "GovernedUnderstandingScope_subject_shape_chk" CHECK (
  ("kind" = 'SELF' AND "contactId" IS NULL AND "relatingId" IS NULL) OR
  ("kind" = 'PERSON_VIEW' AND "contactId" IS NOT NULL AND "relatingId" IS NULL) OR
  ("kind" = 'RELATIONSHIP_VIEW' AND "contactId" IS NULL AND "relatingId" IS NOT NULL)
 )
);
CREATE UNIQUE INDEX "GovernedUnderstandingScope_id_userId_contextSpaceId_key" ON "public"."GovernedUnderstandingScope"("id", "userId", "contextSpaceId");
CREATE INDEX "GovernedUnderstandingScope_userId_contextSpaceId_kind_idx" ON "public"."GovernedUnderstandingScope"("userId", "contextSpaceId", "kind");
CREATE INDEX "GovernedUnderstandingScope_userId_contextSpaceId_contactId_idx" ON "public"."GovernedUnderstandingScope"("userId", "contextSpaceId", "contactId");
CREATE INDEX "GovernedUnderstandingScope_userId_contextSpaceId_relatingId_idx" ON "public"."GovernedUnderstandingScope"("userId", "contextSpaceId", "relatingId");
ALTER TABLE "public"."GovernedUnderstandingScope" ADD CONSTRAINT "GovernedUnderstandingScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."GovernedUnderstandingScope" ADD CONSTRAINT "GovernedUnderstandingScope_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "public"."ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure the subject's Contact or Relating is owned by this exact user and ContextSpace.
-- Composite foreign keys also reject reparenting that would cross custody.
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_id_userId_contextSpaceId_gus_unique" UNIQUE ("id", "userId", "contextSpaceId");
ALTER TABLE "public"."GovernedUnderstandingScope" ADD CONSTRAINT "GovernedUnderstandingScope_contact_scope_fk" FOREIGN KEY ("contactId", "userId", "contextSpaceId") REFERENCES "public"."Contact"("id", "userId", "contextSpaceId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "public"."GovernedUnderstandingScope" ADD CONSTRAINT "GovernedUnderstandingScope_relating_scope_fk" FOREIGN KEY ("relatingId", "userId", "contextSpaceId") REFERENCES "public"."Relating"("id", "userId", "contextSpaceId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "public"."GovernedUnderstandingScopeSource" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "contextSpaceId" TEXT NOT NULL,
 "scopeId" TEXT NOT NULL,
 "interactionId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "GovernedUnderstandingScopeSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernedUnderstandingScopeSource_scopeId_interactionId_key" ON "public"."GovernedUnderstandingScopeSource"("scopeId", "interactionId");
CREATE INDEX "GovernedUnderstandingScopeSource_userId_contextSpaceId_interactionId_idx" ON "public"."GovernedUnderstandingScopeSource"("userId", "contextSpaceId", "interactionId");
ALTER TABLE "public"."GovernedUnderstandingScopeSource" ADD CONSTRAINT "GovernedUnderstandingScopeSource_scope_custody_fk" FOREIGN KEY ("scopeId", "userId", "contextSpaceId") REFERENCES "public"."GovernedUnderstandingScope"("id", "userId", "contextSpaceId") ON DELETE CASCADE ON UPDATE RESTRICT;
-- Interaction already exists and can be linked to multiple scopes without copying it.
ALTER TABLE "public"."GovernedUnderstandingScopeSource" ADD CONSTRAINT "GovernedUnderstandingScopeSource_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "public"."Interaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fail closed if an Interaction belongs to a different owner/context from the scope.
-- Trigger needed because existing Interaction lacks an (id,userId,contextSpaceId) unique key.
CREATE FUNCTION "public"."stage81535_assert_scope_source_custody"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM "public"."Interaction" i
  WHERE i."id" = NEW."interactionId"
  AND i."userId" = NEW."userId" AND i."contextSpaceId" = NEW."contextSpaceId"
 ) THEN
  RAISE EXCEPTION 'governed understanding source custody mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "stage81535_scope_source_custody"
 BEFORE INSERT OR UPDATE OF "interactionId", "userId", "contextSpaceId" ON "public"."GovernedUnderstandingScopeSource"
 FOR EACH ROW EXECUTE FUNCTION "public"."stage81535_assert_scope_source_custody"();

-- A source cannot be moved to another custody scope after it has been linked.
CREATE FUNCTION "public"."stage81535_prevent_linked_interaction_reparent"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD."userId", OLD."contextSpaceId") IS DISTINCT FROM (NEW."userId", NEW."contextSpaceId")
 AND EXISTS (SELECT 1 FROM "public"."GovernedUnderstandingScopeSource" s WHERE s."interactionId" = OLD."id") THEN
  RAISE EXCEPTION 'cannot change custody of linked understanding source' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "stage81535_prevent_linked_interaction_reparent"
 BEFORE UPDATE OF "userId", "contextSpaceId" ON "public"."Interaction"
 FOR EACH ROW EXECUTE FUNCTION "public"."stage81535_prevent_linked_interaction_reparent"();

-- Keep scope owner consistent with ContextSpace ownership (not merely existence).
CREATE FUNCTION "public"."stage81535_assert_scope_owner"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "public"."ContextSpace" c WHERE c."id"=NEW."contextSpaceId" AND c."ownerUserId"=NEW."userId") THEN
  RAISE EXCEPTION 'governed understanding scope owner mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "stage81535_scope_owner" BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "public"."GovernedUnderstandingScope"
 FOR EACH ROW EXECUTE FUNCTION "public"."stage81535_assert_scope_owner"();
