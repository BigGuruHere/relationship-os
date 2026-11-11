BEGIN;

-- CreateEnum
CREATE TYPE "public"."FoundationLuContentKind" AS ENUM ('FACT', 'OBJECTIVE', 'WANT', 'OFFER', 'PREFERENCE', 'CONSTRAINT', 'RELATIONSHIP_STATE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."FoundationLuEpistemicBasis" AS ENUM ('DIRECT_ACCOUNT', 'REPORTED_ASSERTION', 'EXPRESSED_OPINION', 'MODEL_INFERENCE', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "public"."FoundationLuAsserterKind" AS ENUM ('SOURCE_SPEAKER', 'REPORTED_PERSON', 'MODEL', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "public"."FoundationLuGeneratorKind" AS ENUM ('HUMAN_AUTHORED', 'MODEL_DRAFTED', 'HUMAN_EDITED_MODEL_DRAFT');

-- CreateEnum
CREATE TYPE "public"."FoundationLuCandidateOutcome" AS ENUM ('READY', 'NO_CHANGE');

-- CreateEnum
CREATE TYPE "public"."FoundationLuTimeScope" AS ENUM ('CURRENT', 'HISTORICAL', 'MIXED');

-- CreateEnum
CREATE TYPE "public"."FoundationLuTopicEffect" AS ENUM ('NEW', 'REINFORCED', 'REFINED', 'EXPANDED', 'QUALIFIED', 'CONTRADICTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "public"."FoundationLuMeaningRole" AS ENUM ('PRIMARY', 'CONTEXTUAL');

-- AlterEnum
ALTER TYPE "public"."FoundationSupportRelation" ADD VALUE 'CONTEXT';

-- CreateTable
CREATE TABLE "public"."FoundationSourcePresentationVersion" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "sourceVersionNumber" INTEGER NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectKind" "public"."FoundationSubjectKind" NOT NULL DEFAULT 'PERSON',
    "version" INTEGER NOT NULL,
    "previousVersionId" TEXT,
    "previousVersionNumber" INTEGER,
    "summaryEnc" TEXT NOT NULL,
    "provenanceEnc" TEXT NOT NULL,
    "requestMac" TEXT NOT NULL,

    CONSTRAINT "FoundationSourcePresentationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationLuMeaningOrigin" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statementVersionId" TEXT NOT NULL,
    "primarySegmentId" TEXT NOT NULL,
    "contentKind" "public"."FoundationLuContentKind" NOT NULL,
    "epistemicBasis" "public"."FoundationLuEpistemicBasis" NOT NULL,
    "asserterKind" "public"."FoundationLuAsserterKind" NOT NULL,
    "asserterSubjectId" TEXT,
    "asserterSubjectKind" "public"."FoundationSubjectKind",
    "generatorKind" "public"."FoundationLuGeneratorKind" NOT NULL,
    "recorderKind" "public"."FoundationRecorderKind" NOT NULL,
    "generationEnc" TEXT NOT NULL,

    CONSTRAINT "FoundationLuMeaningOrigin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationLuStream" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subjectId" TEXT NOT NULL,
    "perspectiveId" TEXT NOT NULL,

    CONSTRAINT "FoundationLuStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationLuTopic" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streamId" TEXT NOT NULL,

    CONSTRAINT "FoundationLuTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationLuCandidate" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "sourceVersionNumber" INTEGER NOT NULL,
    "sourceContentMac" TEXT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "outcome" "public"."FoundationLuCandidateOutcome" NOT NULL,
    "proposalEnc" TEXT NOT NULL,

    CONSTRAINT "FoundationLuCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationLuApproval" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT NOT NULL,
    "requestKeyMac" TEXT NOT NULL,
    "requestMac" TEXT NOT NULL,
    "selectionEnc" TEXT NOT NULL,

    CONSTRAINT "FoundationLuApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationLuRevision" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streamId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "previousRevisionId" TEXT,
    "previousRevisionNumber" INTEGER,
    "approvalId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,

    CONSTRAINT "FoundationLuRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationLuTopicVersion" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streamId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "previousVersionId" TEXT,
    "previousVersionNumber" INTEGER,
    "creatingRevisionId" TEXT NOT NULL,
    "timeScope" "public"."FoundationLuTimeScope" NOT NULL,
    "effect" "public"."FoundationLuTopicEffect" NOT NULL,
    "contentEnc" TEXT NOT NULL,

    CONSTRAINT "FoundationLuTopicVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationLuTopicMeaning" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topicVersionId" TEXT NOT NULL,
    "statementVersionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "role" "public"."FoundationLuMeaningRole" NOT NULL,

    CONSTRAINT "FoundationLuTopicMeaning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationLuRevisionTopic" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisionId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "topicVersionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "FoundationLuRevisionTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoundationSourcePresentationVersion_ownerUserId_vaultId_sub_idx" ON "public"."FoundationSourcePresentationVersion"("ownerUserId", "vaultId", "subjectId", "version", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationSourcePresentationVersion_id_ownerUserId_vaultId_key" ON "public"."FoundationSourcePresentationVersion"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationSourcePresentationVersion_sourceId_version_key" ON "public"."FoundationSourcePresentationVersion"("sourceId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationSourcePresentationVersion_id_sourceId_subjectId_v_key" ON "public"."FoundationSourcePresentationVersion"("id", "sourceId", "subjectId", "version", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuMeaningOrigin_statementVersionId_key" ON "public"."FoundationLuMeaningOrigin"("statementVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuMeaningOrigin_id_ownerUserId_vaultId_key" ON "public"."FoundationLuMeaningOrigin"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuStream_id_ownerUserId_vaultId_key" ON "public"."FoundationLuStream"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuStream_vaultId_subjectId_perspectiveId_key" ON "public"."FoundationLuStream"("vaultId", "subjectId", "perspectiveId");

-- CreateIndex
CREATE INDEX "FoundationLuTopic_ownerUserId_vaultId_streamId_idx" ON "public"."FoundationLuTopic"("ownerUserId", "vaultId", "streamId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuTopic_id_ownerUserId_vaultId_key" ON "public"."FoundationLuTopic"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuTopic_id_streamId_ownerUserId_vaultId_key" ON "public"."FoundationLuTopic"("id", "streamId", "ownerUserId", "vaultId");

-- CreateIndex
CREATE INDEX "FoundationLuCandidate_ownerUserId_vaultId_sourceVersionId_c_idx" ON "public"."FoundationLuCandidate"("ownerUserId", "vaultId", "sourceVersionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuCandidate_id_ownerUserId_vaultId_key" ON "public"."FoundationLuCandidate"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuApproval_id_ownerUserId_vaultId_key" ON "public"."FoundationLuApproval"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuApproval_vaultId_requestKeyMac_key" ON "public"."FoundationLuApproval"("vaultId", "requestKeyMac");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuApproval_candidateId_key" ON "public"."FoundationLuApproval"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuRevision_id_ownerUserId_vaultId_key" ON "public"."FoundationLuRevision"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuRevision_streamId_revisionNumber_key" ON "public"."FoundationLuRevision"("streamId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuRevision_id_streamId_revisionNumber_ownerUserId_key" ON "public"."FoundationLuRevision"("id", "streamId", "revisionNumber", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuRevision_id_streamId_ownerUserId_vaultId_key" ON "public"."FoundationLuRevision"("id", "streamId", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuTopicVersion_id_ownerUserId_vaultId_key" ON "public"."FoundationLuTopicVersion"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuTopicVersion_topicId_version_key" ON "public"."FoundationLuTopicVersion"("topicId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuTopicVersion_id_topicId_streamId_version_ownerU_key" ON "public"."FoundationLuTopicVersion"("id", "topicId", "streamId", "version", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuTopicVersion_id_topicId_streamId_ownerUserId_va_key" ON "public"."FoundationLuTopicVersion"("id", "topicId", "streamId", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuTopicMeaning_id_ownerUserId_vaultId_key" ON "public"."FoundationLuTopicMeaning"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuTopicMeaning_topicVersionId_statementVersionId_key" ON "public"."FoundationLuTopicMeaning"("topicVersionId", "statementVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuTopicMeaning_topicVersionId_position_key" ON "public"."FoundationLuTopicMeaning"("topicVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuRevisionTopic_id_ownerUserId_vaultId_key" ON "public"."FoundationLuRevisionTopic"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuRevisionTopic_revisionId_topicId_key" ON "public"."FoundationLuRevisionTopic"("revisionId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationLuRevisionTopic_revisionId_position_key" ON "public"."FoundationLuRevisionTopic"("revisionId", "position");

-- AddForeignKey
ALTER TABLE "public"."FoundationSourcePresentationVersion" ADD CONSTRAINT "FoundationSourcePresentationVersion_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSourcePresentationVersion" ADD CONSTRAINT "FoundationSourcePresentationVersion_sourceVersionId_source_fkey" FOREIGN KEY ("sourceVersionId", "sourceId", "sourceVersionNumber", "ownerUserId", "vaultId") REFERENCES "public"."FoundationSourceVersion"("id", "sourceId", "version", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSourcePresentationVersion" ADD CONSTRAINT "FoundationSourcePresentationVersion_subjectId_ownerUserId__fkey" FOREIGN KEY ("subjectId", "ownerUserId", "vaultId", "subjectKind") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSourcePresentationVersion" ADD CONSTRAINT "FoundationSourcePresentationVersion_previousVersionId_sour_fkey" FOREIGN KEY ("previousVersionId", "sourceId", "subjectId", "previousVersionNumber", "ownerUserId", "vaultId") REFERENCES "public"."FoundationSourcePresentationVersion"("id", "sourceId", "subjectId", "version", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuMeaningOrigin" ADD CONSTRAINT "FoundationLuMeaningOrigin_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuMeaningOrigin" ADD CONSTRAINT "FoundationLuMeaningOrigin_statementVersionId_ownerUserId_v_fkey" FOREIGN KEY ("statementVersionId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationStatementVersion"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuMeaningOrigin" ADD CONSTRAINT "FoundationLuMeaningOrigin_primarySegmentId_ownerUserId_vau_fkey" FOREIGN KEY ("primarySegmentId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationEvidenceSegment"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuMeaningOrigin" ADD CONSTRAINT "FoundationLuMeaningOrigin_asserterSubjectId_ownerUserId_va_fkey" FOREIGN KEY ("asserterSubjectId", "ownerUserId", "vaultId", "asserterSubjectKind") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuStream" ADD CONSTRAINT "FoundationLuStream_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuStream" ADD CONSTRAINT "FoundationLuStream_subjectId_ownerUserId_vaultId_fkey" FOREIGN KEY ("subjectId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuStream" ADD CONSTRAINT "FoundationLuStream_perspectiveId_ownerUserId_vaultId_fkey" FOREIGN KEY ("perspectiveId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationPerspective"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuTopic" ADD CONSTRAINT "FoundationLuTopic_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuTopic" ADD CONSTRAINT "FoundationLuTopic_streamId_ownerUserId_vaultId_fkey" FOREIGN KEY ("streamId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuStream"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuCandidate" ADD CONSTRAINT "FoundationLuCandidate_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuCandidate" ADD CONSTRAINT "FoundationLuCandidate_sourceVersionId_sourceId_sourceVersi_fkey" FOREIGN KEY ("sourceVersionId", "sourceId", "sourceVersionNumber", "ownerUserId", "vaultId") REFERENCES "public"."FoundationSourceVersion"("id", "sourceId", "version", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuApproval" ADD CONSTRAINT "FoundationLuApproval_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuApproval" ADD CONSTRAINT "FoundationLuApproval_candidateId_ownerUserId_vaultId_fkey" FOREIGN KEY ("candidateId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuCandidate"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuRevision" ADD CONSTRAINT "FoundationLuRevision_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuRevision" ADD CONSTRAINT "FoundationLuRevision_streamId_ownerUserId_vaultId_fkey" FOREIGN KEY ("streamId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuStream"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuRevision" ADD CONSTRAINT "FoundationLuRevision_previousRevisionId_streamId_previousR_fkey" FOREIGN KEY ("previousRevisionId", "streamId", "previousRevisionNumber", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuRevision"("id", "streamId", "revisionNumber", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuRevision" ADD CONSTRAINT "FoundationLuRevision_approvalId_ownerUserId_vaultId_fkey" FOREIGN KEY ("approvalId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuApproval"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuRevision" ADD CONSTRAINT "FoundationLuRevision_sourceVersionId_ownerUserId_vaultId_fkey" FOREIGN KEY ("sourceVersionId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationSourceVersion"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuTopicVersion" ADD CONSTRAINT "FoundationLuTopicVersion_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuTopicVersion" ADD CONSTRAINT "FoundationLuTopicVersion_topicId_streamId_ownerUserId_vaul_fkey" FOREIGN KEY ("topicId", "streamId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuTopic"("id", "streamId", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuTopicVersion" ADD CONSTRAINT "FoundationLuTopicVersion_previousVersionId_topicId_streamI_fkey" FOREIGN KEY ("previousVersionId", "topicId", "streamId", "previousVersionNumber", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuTopicVersion"("id", "topicId", "streamId", "version", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuTopicVersion" ADD CONSTRAINT "FoundationLuTopicVersion_creatingRevisionId_streamId_owner_fkey" FOREIGN KEY ("creatingRevisionId", "streamId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuRevision"("id", "streamId", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuTopicMeaning" ADD CONSTRAINT "FoundationLuTopicMeaning_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuTopicMeaning" ADD CONSTRAINT "FoundationLuTopicMeaning_topicVersionId_ownerUserId_vaultI_fkey" FOREIGN KEY ("topicVersionId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuTopicVersion"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuTopicMeaning" ADD CONSTRAINT "FoundationLuTopicMeaning_statementVersionId_ownerUserId_va_fkey" FOREIGN KEY ("statementVersionId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationStatementVersion"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuRevisionTopic" ADD CONSTRAINT "FoundationLuRevisionTopic_vaultId_ownerUserId_fkey" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuRevisionTopic" ADD CONSTRAINT "FoundationLuRevisionTopic_revisionId_streamId_ownerUserId__fkey" FOREIGN KEY ("revisionId", "streamId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuRevision"("id", "streamId", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationLuRevisionTopic" ADD CONSTRAINT "FoundationLuRevisionTopic_topicVersionId_topicId_streamId__fkey" FOREIGN KEY ("topicVersionId", "topicId", "streamId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationLuTopicVersion"("id", "topicId", "streamId", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Exact immutable ancestry. The same-scope foreign keys above bind each predecessor.
ALTER TABLE "FoundationSourcePresentationVersion" ADD CONSTRAINT lur2_presentation_lineage CHECK (
  "subjectKind" = 'PERSON' AND (
    (version = 1 AND "previousVersionId" IS NULL AND "previousVersionNumber" IS NULL)
    OR (version > 1 AND "previousVersionId" IS NOT NULL AND "previousVersionNumber" = version - 1 AND "previousVersionNumber" IS NOT NULL)
  )
);
ALTER TABLE "FoundationLuRevision" ADD CONSTRAINT lur2_revision_lineage CHECK (
  ("revisionNumber" = 1 AND "previousRevisionId" IS NULL AND "previousRevisionNumber" IS NULL)
  OR ("revisionNumber" > 1 AND "previousRevisionId" IS NOT NULL AND "previousRevisionNumber" = "revisionNumber" - 1 AND "previousRevisionNumber" IS NOT NULL)
);
ALTER TABLE "FoundationLuTopicVersion" ADD CONSTRAINT lur2_topic_lineage CHECK (
  (version = 1 AND effect = 'NEW' AND "previousVersionId" IS NULL AND "previousVersionNumber" IS NULL)
  OR (version > 1 AND effect <> 'NEW' AND "previousVersionId" IS NOT NULL AND "previousVersionNumber" = version - 1 AND "previousVersionNumber" IS NOT NULL)
);
ALTER TABLE "FoundationLuMeaningOrigin" ADD CONSTRAINT lur2_asserter_shape CHECK (
  ("asserterSubjectId" IS NULL AND "asserterSubjectKind" IS NULL)
  OR ("asserterSubjectId" IS NOT NULL AND "asserterSubjectKind" IS NOT NULL AND "asserterSubjectKind" = 'PERSON')
);
ALTER TABLE "FoundationLuRevisionTopic" ADD CONSTRAINT lur2_snapshot_position CHECK (position >= 0);
ALTER TABLE "FoundationLuTopicMeaning" ADD CONSTRAINT lur2_meaning_position CHECK (position >= 0);

-- Old rows and tables are retained. New content is append-only; reviewed erasure can delete it.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'FoundationSourcePresentationVersion', 'FoundationLuMeaningOrigin', 'FoundationLuStream',
    'FoundationLuTopic', 'FoundationLuTopicVersion', 'FoundationLuTopicMeaning',
    'FoundationLuRevision', 'FoundationLuRevisionTopic', 'FoundationLuCandidate', 'FoundationLuApproval'
  ] LOOP
    EXECUTE format('CREATE TRIGGER lur2_immutable BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields()', table_name);
  END LOOP;
END;
$$;

COMMIT;
