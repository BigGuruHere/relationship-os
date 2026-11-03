-- F-202: additive schema only. No legacy data backfill, enrolment or route activation.
-- Run through the normal migration workflow only after target inventory/backup review.
BEGIN;

-- CreateEnum
CREATE TYPE "public"."FoundationEnrollmentState" AS ENUM ('PREPARED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."FoundationVaultKind" AS ENUM ('PRIVATE_HOME');

-- CreateEnum
CREATE TYPE "public"."FoundationVaultState" AS ENUM ('ACTIVE', 'LOCKED', 'DELETING');

-- CreateEnum
CREATE TYPE "public"."FoundationSubjectKind" AS ENUM ('PERSON', 'RELATIONSHIP', 'GROUP');

-- CreateEnum
CREATE TYPE "public"."FoundationSubjectState" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETING');

-- CreateEnum
CREATE TYPE "public"."FoundationPerspectiveKind" AS ENUM ('OWNER_RECORDED', 'ATTRIBUTED_PERSON', 'AI_INTERPRETATION');

-- CreateEnum
CREATE TYPE "public"."FoundationSourceKind" AS ENUM ('OWNER_NOTE', 'VOICE_NOTE', 'CONTACT_EXCHANGE', 'IMPORTED_CONVERSATION');

-- CreateEnum
CREATE TYPE "public"."FoundationRecordState" AS ENUM ('ACTIVE', 'DISABLED', 'DELETING');

-- CreateEnum
CREATE TYPE "public"."FoundationAdmission" AS ENUM ('STORED_ONLY', 'PRIVATE_ANALYSIS');

-- CreateEnum
CREATE TYPE "public"."FoundationRecorderKind" AS ENUM ('OWNER', 'VISITOR', 'SERVICE');

-- CreateEnum
CREATE TYPE "public"."FoundationStatementMode" AS ENUM ('DECLARED', 'OBSERVED', 'INFERRED');

-- CreateEnum
CREATE TYPE "public"."FoundationConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."FoundationSupportRelation" AS ENUM ('SUPPORTS', 'QUALIFIES', 'CONTRADICTS');

-- CreateEnum
CREATE TYPE "public"."FoundationContextState" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "public"."FoundationEnrollment" (
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" "public"."FoundationEnrollmentState" NOT NULL DEFAULT 'PREPARED',
    "epoch" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoundationEnrollment_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."FoundationVault" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "public"."FoundationVaultKind" NOT NULL DEFAULT 'PRIVATE_HOME',
    "state" "public"."FoundationVaultState" NOT NULL DEFAULT 'ACTIVE',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoundationVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationSubject" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "public"."FoundationSubjectKind" NOT NULL,
    "displayNameEnc" TEXT NOT NULL,
    "detailsEnc" TEXT,
    "selfUserId" TEXT,
    "state" "public"."FoundationSubjectState" NOT NULL DEFAULT 'ACTIVE',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoundationSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationMembership" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "containerSubjectId" TEXT NOT NULL,
    "containerKind" "public"."FoundationSubjectKind" NOT NULL,
    "personSubjectId" TEXT NOT NULL,
    "personKind" "public"."FoundationSubjectKind" NOT NULL DEFAULT 'PERSON',
    "roleEnc" TEXT,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),

    CONSTRAINT "FoundationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationPerspective" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "public"."FoundationPerspectiveKind" NOT NULL,
    "holderSubjectId" TEXT,
    "holderKind" "public"."FoundationSubjectKind",
    "descriptionEnc" TEXT,

    CONSTRAINT "FoundationPerspective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationSource" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "public"."FoundationSourceKind" NOT NULL,
    "ingestKey" TEXT NOT NULL,
    "state" "public"."FoundationRecordState" NOT NULL DEFAULT 'ACTIVE',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoundationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationSourceVersion" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "previousVersionId" TEXT,
    "previousVersionNumber" INTEGER,
    "payloadEnc" TEXT NOT NULL,
    "contentMac" TEXT NOT NULL,
    "processingAdmission" "public"."FoundationAdmission" NOT NULL DEFAULT 'STORED_ONLY',
    "occurredAt" TIMESTAMPTZ(3),
    "recordedByKind" "public"."FoundationRecorderKind" NOT NULL,
    "provenanceEnc" TEXT NOT NULL,

    CONSTRAINT "FoundationSourceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationEvidenceSegment" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceVersionId" TEXT NOT NULL,
    "speakerSubjectId" TEXT,
    "speakerKind" "public"."FoundationSubjectKind",
    "anchorEnc" TEXT NOT NULL,
    "excerptEnc" TEXT NOT NULL,
    "anchorMac" TEXT NOT NULL,

    CONSTRAINT "FoundationEvidenceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationEvidenceSubject" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "segmentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "FoundationEvidenceSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationStatement" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "perspectiveId" TEXT NOT NULL,
    "state" "public"."FoundationRecordState" NOT NULL DEFAULT 'ACTIVE',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoundationStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationStatementVersion" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statementId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "previousVersionId" TEXT,
    "previousVersionNumber" INTEGER,
    "textEnc" TEXT NOT NULL,
    "mode" "public"."FoundationStatementMode" NOT NULL,
    "confidence" "public"."FoundationConfidence" NOT NULL,
    "observedAt" TIMESTAMPTZ(3),
    "validFrom" TIMESTAMPTZ(3),
    "validUntil" TIMESTAMPTZ(3),
    "provenanceEnc" TEXT NOT NULL,

    CONSTRAINT "FoundationStatementVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationStatementSubject" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statementVersionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "FoundationStatementSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationSupport" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outputVersionId" TEXT NOT NULL,
    "segmentId" TEXT,
    "inputVersionId" TEXT,
    "relation" "public"."FoundationSupportRelation" NOT NULL,

    CONSTRAINT "FoundationSupport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationContext" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "labelEnc" TEXT NOT NULL,
    "descriptionEnc" TEXT,
    "state" "public"."FoundationContextState" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "FoundationContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoundationContextAssociation" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contextId" TEXT NOT NULL,
    "segmentId" TEXT,
    "statementVersionId" TEXT,

    CONSTRAINT "FoundationContextAssociation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "f202_vault_scope" ON "public"."FoundationVault"("id", "ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_vault_owner_kind" ON "public"."FoundationVault"("ownerUserId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "f202_subject_self" ON "public"."FoundationSubject"("selfUserId");

-- CreateIndex
CREATE INDEX "f202_subject_listing" ON "public"."FoundationSubject"("ownerUserId", "vaultId", "kind", "state");

-- CreateIndex
CREATE UNIQUE INDEX "f202_subject_scope" ON "public"."FoundationSubject"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_subject_typed" ON "public"."FoundationSubject"("id", "ownerUserId", "vaultId", "kind");

-- CreateIndex
CREATE INDEX "f202_membersh_containersubject" ON "public"."FoundationMembership"("ownerUserId", "vaultId", "containerSubjectId");

-- CreateIndex
CREATE INDEX "f202_membersh_personsubjectid" ON "public"."FoundationMembership"("ownerUserId", "vaultId", "personSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_membership_scope" ON "public"."FoundationMembership"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE INDEX "f202_perspect_holdersubjectid" ON "public"."FoundationPerspective"("ownerUserId", "vaultId", "holderSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_perspective_scope" ON "public"."FoundationPerspective"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE INDEX "f202_source_listing" ON "public"."FoundationSource"("ownerUserId", "vaultId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "f202_source_scope" ON "public"."FoundationSource"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_source_ingest" ON "public"."FoundationSource"("vaultId", "ingestKey");

-- CreateIndex
CREATE UNIQUE INDEX "f202_sourceversion_scope" ON "public"."FoundationSourceVersion"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_sourceversion_number" ON "public"."FoundationSourceVersion"("sourceId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "f202_sourceversion_lineage" ON "public"."FoundationSourceVersion"("id", "sourceId", "version", "ownerUserId", "vaultId");

-- CreateIndex
CREATE INDEX "f202_evidence_sourceversionid" ON "public"."FoundationEvidenceSegment"("ownerUserId", "vaultId", "sourceVersionId");

-- CreateIndex
CREATE INDEX "f202_evidence_speakersubjectid" ON "public"."FoundationEvidenceSegment"("ownerUserId", "vaultId", "speakerSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_evidencesegment_scope" ON "public"."FoundationEvidenceSegment"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_segment_anchor" ON "public"."FoundationEvidenceSegment"("vaultId", "sourceVersionId", "anchorMac");

-- CreateIndex
CREATE INDEX "f202_evidence_subjectid" ON "public"."FoundationEvidenceSubject"("ownerUserId", "vaultId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_evidencesubject_scope" ON "public"."FoundationEvidenceSubject"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_evidence_subject" ON "public"."FoundationEvidenceSubject"("segmentId", "subjectId");

-- CreateIndex
CREATE INDEX "f202_statement_listing" ON "public"."FoundationStatement"("ownerUserId", "vaultId", "state", "perspectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_statement_scope" ON "public"."FoundationStatement"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_statementversion_scope" ON "public"."FoundationStatementVersion"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_statementversion_number" ON "public"."FoundationStatementVersion"("statementId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "f202_statementversion_lineage" ON "public"."FoundationStatementVersion"("id", "statementId", "version", "ownerUserId", "vaultId");

-- CreateIndex
CREATE INDEX "f202_statemen_subjectid" ON "public"."FoundationStatementSubject"("ownerUserId", "vaultId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_statementsubject_scope" ON "public"."FoundationStatementSubject"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_statement_subject" ON "public"."FoundationStatementSubject"("statementVersionId", "subjectId");

-- CreateIndex
CREATE INDEX "f202_support_outputversionid" ON "public"."FoundationSupport"("ownerUserId", "vaultId", "outputVersionId");

-- CreateIndex
CREATE INDEX "f202_support_segmentid" ON "public"."FoundationSupport"("ownerUserId", "vaultId", "segmentId");

-- CreateIndex
CREATE INDEX "f202_support_inputversionid" ON "public"."FoundationSupport"("ownerUserId", "vaultId", "inputVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_support_scope" ON "public"."FoundationSupport"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_context_scope" ON "public"."FoundationContext"("id", "ownerUserId", "vaultId");

-- CreateIndex
CREATE INDEX "f202_contexta_contextid" ON "public"."FoundationContextAssociation"("ownerUserId", "vaultId", "contextId");

-- CreateIndex
CREATE INDEX "f202_contexta_segmentid" ON "public"."FoundationContextAssociation"("ownerUserId", "vaultId", "segmentId");

-- CreateIndex
CREATE INDEX "f202_contexta_statementversion" ON "public"."FoundationContextAssociation"("ownerUserId", "vaultId", "statementVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "f202_contextassociation_scope" ON "public"."FoundationContextAssociation"("id", "ownerUserId", "vaultId");

-- AddForeignKey
ALTER TABLE "public"."FoundationEnrollment" ADD CONSTRAINT "f202_fk_1" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationVault" ADD CONSTRAINT "f202_fk_2" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSubject" ADD CONSTRAINT "f202_fk_3" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSubject" ADD CONSTRAINT "f202_fk_16" FOREIGN KEY ("selfUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationMembership" ADD CONSTRAINT "f202_fk_4" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationMembership" ADD CONSTRAINT "f202_fk_17" FOREIGN KEY ("containerSubjectId", "ownerUserId", "vaultId", "containerKind") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationMembership" ADD CONSTRAINT "f202_fk_18" FOREIGN KEY ("personSubjectId", "ownerUserId", "vaultId", "personKind") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationPerspective" ADD CONSTRAINT "f202_fk_5" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationPerspective" ADD CONSTRAINT "f202_fk_19" FOREIGN KEY ("holderSubjectId", "ownerUserId", "vaultId", "holderKind") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSource" ADD CONSTRAINT "f202_fk_6" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSourceVersion" ADD CONSTRAINT "f202_fk_7" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSourceVersion" ADD CONSTRAINT "f202_fk_20" FOREIGN KEY ("sourceId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationSource"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSourceVersion" ADD CONSTRAINT "f202_fk_21" FOREIGN KEY ("previousVersionId", "sourceId", "previousVersionNumber", "ownerUserId", "vaultId") REFERENCES "public"."FoundationSourceVersion"("id", "sourceId", "version", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationEvidenceSegment" ADD CONSTRAINT "f202_fk_8" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationEvidenceSegment" ADD CONSTRAINT "f202_fk_24" FOREIGN KEY ("sourceVersionId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationSourceVersion"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationEvidenceSegment" ADD CONSTRAINT "f202_fk_25" FOREIGN KEY ("speakerSubjectId", "ownerUserId", "vaultId", "speakerKind") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationEvidenceSubject" ADD CONSTRAINT "f202_fk_9" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationEvidenceSubject" ADD CONSTRAINT "f202_fk_26" FOREIGN KEY ("segmentId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationEvidenceSegment"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationEvidenceSubject" ADD CONSTRAINT "f202_fk_27" FOREIGN KEY ("subjectId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationStatement" ADD CONSTRAINT "f202_fk_10" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationStatement" ADD CONSTRAINT "f202_fk_28" FOREIGN KEY ("perspectiveId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationPerspective"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationStatementVersion" ADD CONSTRAINT "f202_fk_11" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationStatementVersion" ADD CONSTRAINT "f202_fk_22" FOREIGN KEY ("statementId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationStatement"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationStatementVersion" ADD CONSTRAINT "f202_fk_23" FOREIGN KEY ("previousVersionId", "statementId", "previousVersionNumber", "ownerUserId", "vaultId") REFERENCES "public"."FoundationStatementVersion"("id", "statementId", "version", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationStatementSubject" ADD CONSTRAINT "f202_fk_12" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationStatementSubject" ADD CONSTRAINT "f202_fk_29" FOREIGN KEY ("statementVersionId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationStatementVersion"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationStatementSubject" ADD CONSTRAINT "f202_fk_30" FOREIGN KEY ("subjectId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationSubject"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSupport" ADD CONSTRAINT "f202_fk_13" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSupport" ADD CONSTRAINT "f202_fk_31" FOREIGN KEY ("outputVersionId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationStatementVersion"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSupport" ADD CONSTRAINT "f202_fk_32" FOREIGN KEY ("segmentId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationEvidenceSegment"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationSupport" ADD CONSTRAINT "f202_fk_33" FOREIGN KEY ("inputVersionId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationStatementVersion"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationContext" ADD CONSTRAINT "f202_fk_14" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationContextAssociation" ADD CONSTRAINT "f202_fk_15" FOREIGN KEY ("vaultId", "ownerUserId") REFERENCES "public"."FoundationVault"("id", "ownerUserId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationContextAssociation" ADD CONSTRAINT "f202_fk_34" FOREIGN KEY ("contextId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationContext"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationContextAssociation" ADD CONSTRAINT "f202_fk_35" FOREIGN KEY ("segmentId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationEvidenceSegment"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "public"."FoundationContextAssociation" ADD CONSTRAINT "f202_fk_36" FOREIGN KEY ("statementVersionId", "ownerUserId", "vaultId") REFERENCES "public"."FoundationStatementVersion"("id", "ownerUserId", "vaultId") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- F-202 SQL-only invariants. Prisma represents the FK/index graph above;
-- CHECKs, partial indexes and deferred triggers below are equally authoritative.
-- Functions pin their lookup path so temporary tables cannot shadow integrity checks.
ALTER TABLE "FoundationEnrollment" ADD CONSTRAINT f202_enrollment_epoch CHECK (epoch > 0);
ALTER TABLE "FoundationSubject" ADD CONSTRAINT f202_subject_self_shape CHECK (
  "selfUserId" IS NULL OR (kind = 'PERSON' AND "selfUserId" = "ownerUserId")
);
ALTER TABLE "FoundationMembership" ADD CONSTRAINT f202_member_shape CHECK (
  "containerKind" IN ('RELATIONSHIP','GROUP') AND "personKind" = 'PERSON'
  AND ("leftAt" IS NULL OR "leftAt" >= "joinedAt")
);
CREATE UNIQUE INDEX f202_membership_active ON "FoundationMembership" ("vaultId","containerSubjectId","personSubjectId") WHERE "leftAt" IS NULL;
ALTER TABLE "FoundationPerspective" ADD CONSTRAINT f202_perspective_shape CHECK (
  (kind = 'ATTRIBUTED_PERSON' AND "holderSubjectId" IS NOT NULL AND "holderKind" IS NOT NULL AND "holderKind" = 'PERSON') OR
  (kind IN ('OWNER_RECORDED','AI_INTERPRETATION') AND "holderSubjectId" IS NULL AND "holderKind" IS NULL)
);
ALTER TABLE "FoundationEvidenceSegment" ADD CONSTRAINT f202_speaker_shape CHECK (
  ("speakerSubjectId" IS NULL AND "speakerKind" IS NULL) OR
  ("speakerSubjectId" IS NOT NULL AND "speakerKind" IS NOT NULL AND "speakerKind" = 'PERSON')
);
ALTER TABLE "FoundationSourceVersion" ADD CONSTRAINT f202_source_lineage_shape CHECK (
  (version = 1 AND "previousVersionId" IS NULL AND "previousVersionNumber" IS NULL) OR
  (version > 1 AND "previousVersionId" IS NOT NULL AND "previousVersionNumber" IS NOT NULL AND "previousVersionNumber" = version - 1)
);
ALTER TABLE "FoundationStatementVersion" ADD CONSTRAINT f202_statement_lineage_shape CHECK (
  (version = 1 AND "previousVersionId" IS NULL AND "previousVersionNumber" IS NULL) OR
  (version > 1 AND "previousVersionId" IS NOT NULL AND "previousVersionNumber" IS NOT NULL AND "previousVersionNumber" = version - 1)
), ADD CONSTRAINT f202_statement_validity CHECK ("validFrom" IS NULL OR "validUntil" IS NULL OR "validUntil" >= "validFrom");
ALTER TABLE "FoundationSupport" ADD CONSTRAINT f202_support_shape CHECK (
  ("segmentId" IS NOT NULL AND "inputVersionId" IS NULL) OR
  ("segmentId" IS NULL AND "inputVersionId" IS NOT NULL AND "inputVersionId" <> "outputVersionId")
);
CREATE UNIQUE INDEX f202_support_segment ON "FoundationSupport" ("outputVersionId","segmentId",relation) WHERE "segmentId" IS NOT NULL;
CREATE UNIQUE INDEX f202_support_input ON "FoundationSupport" ("outputVersionId","inputVersionId",relation) WHERE "inputVersionId" IS NOT NULL;
ALTER TABLE "FoundationContextAssociation" ADD CONSTRAINT f202_context_target CHECK (
  ("segmentId" IS NOT NULL AND "statementVersionId" IS NULL) OR
  ("segmentId" IS NULL AND "statementVersionId" IS NOT NULL)
);
CREATE UNIQUE INDEX f202_context_segment ON "FoundationContextAssociation" ("contextId","segmentId") WHERE "segmentId" IS NOT NULL;
CREATE UNIQUE INDEX f202_context_version ON "FoundationContextAssociation" ("contextId","statementVersionId") WHERE "statementVersionId" IS NOT NULL;

-- Immutable row identities/custody and version content cannot be reparented.
-- Arguments name the ONLY mutable fields, never arbitrary client-supplied fields.
-- Zero-argument triggers supply NULL TG_ARGV: coalesce it or comparison becomes NULL.
CREATE FUNCTION f202_immutable_fields() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF (to_jsonb(NEW) - COALESCE(TG_ARGV, ARRAY[]::text[])) IS DISTINCT FROM (to_jsonb(OLD) - COALESCE(TG_ARGV, ARRAY[]::text[])) THEN
    RAISE EXCEPTION 'immutable foundation fields' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationEnrollment" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields('state','epoch','updatedAt');
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationVault" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields('state','updatedAt');
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationSubject" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields('displayNameEnc','detailsEnc','state','updatedAt');
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationMembership" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields('roleEnc','leftAt');
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationPerspective" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields();
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationSource" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields('state','updatedAt');
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationSourceVersion" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields();
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationEvidenceSegment" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields();
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationEvidenceSubject" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields();
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationStatement" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields('state','updatedAt');
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationStatementVersion" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields();
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationStatementSubject" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields();
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationSupport" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields();
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationContext" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields('labelEnc','descriptionEnc','state');
CREATE TRIGGER f202_immutable BEFORE UPDATE ON "FoundationContextAssociation" FOR EACH ROW EXECUTE FUNCTION f202_immutable_fields();

-- Epoch changes make old server-side access contexts stale when enrolment changes.
CREATE FUNCTION f202_enrollment_epoch_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.epoch < OLD.epoch OR (NEW.state IS DISTINCT FROM OLD.state AND NEW.epoch <= OLD.epoch) THEN
    RAISE EXCEPTION 'foundation enrolment requires a new epoch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER f202_epoch BEFORE UPDATE ON "FoundationEnrollment" FOR EACH ROW EXECUTE FUNCTION f202_enrollment_epoch_guard();

-- A row UPDATE, not just SELECT FOR UPDATE, serializes graph writers under
-- repeatable-read/serializable snapshots too: stale writers must retry 40001.
-- This is integrity serialization, not an actor permission check.
CREATE FUNCTION f202_graph_lock() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v text; o text;
BEGIN
  IF TG_OP = 'DELETE' THEN v := OLD."vaultId"; o := OLD."ownerUserId";
  ELSE v := NEW."vaultId"; o := NEW."ownerUserId"; END IF;
  UPDATE "FoundationVault" SET "updatedAt" = clock_timestamp() WHERE id=v AND "ownerUserId"=o;
  IF NOT FOUND THEN RAISE EXCEPTION 'foundation vault unavailable' USING ERRCODE='23503'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER f202_graph_lock BEFORE INSERT OR UPDATE OR DELETE ON "FoundationSupport" FOR EACH ROW EXECUTE FUNCTION f202_graph_lock();
CREATE TRIGGER f202_graph_lock BEFORE INSERT OR UPDATE OR DELETE ON "FoundationStatementSubject" FOR EACH ROW EXECUTE FUNCTION f202_graph_lock();
CREATE TRIGGER f202_graph_lock BEFORE INSERT OR UPDATE OR DELETE ON "FoundationStatementVersion" FOR EACH ROW EXECUTE FUNCTION f202_graph_lock();
CREATE TRIGGER f202_graph_lock BEFORE INSERT OR UPDATE OR DELETE ON "FoundationStatement" FOR EACH ROW EXECUTE FUNCTION f202_graph_lock();

-- Edge direction is output -> input. An input reaching the proposed output is
-- a cycle, regardless of SUPPORTS / QUALIFIES / CONTRADICTS interpretation.
CREATE FUNCTION f202_no_cycle() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW."inputVersionId" IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors(id) AS (
      SELECT NEW."inputVersionId"
      UNION
      SELECT s."inputVersionId" FROM "FoundationSupport" s JOIN ancestors a ON s."outputVersionId"=a.id
      WHERE s."inputVersionId" IS NOT NULL AND s."vaultId"=NEW."vaultId" AND s."ownerUserId"=NEW."ownerUserId"
    ) SELECT 1 FROM ancestors WHERE id=NEW."outputVersionId"
  ) THEN RAISE EXCEPTION 'foundation derivation cycle' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
-- PostgreSQL orders same-event triggers by name; graph lock must happen first.
CREATE TRIGGER f202_z_no_cycle BEFORE INSERT ON "FoundationSupport" FOR EACH ROW EXECUTE FUNCTION f202_no_cycle();

-- Check complete versions at COMMIT, allowing version/subjects/evidence to be
-- inserted in one transaction. Recheck roots on reactivation to close the
-- disable -> strip evidence -> reactivate loophole.
CREATE FUNCTION f202_assert_complete(version_id text, force_check boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE root_state "FoundationRecordState";
BEGIN
  SELECT s.state INTO root_state FROM "FoundationStatementVersion" v
    JOIN "FoundationStatement" s ON s.id=v."statementId" WHERE v.id=version_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF force_check OR root_state='ACTIVE' THEN
    IF NOT EXISTS (SELECT 1 FROM "FoundationStatementSubject" WHERE "statementVersionId"=version_id)
      OR NOT EXISTS (SELECT 1 FROM "FoundationSupport" WHERE "outputVersionId"=version_id AND relation='SUPPORTS') THEN
      RAISE EXCEPTION 'foundation statement requires subject and supporting evidence' USING ERRCODE='23514';
    END IF;
  END IF;
END;
$$;
CREATE FUNCTION f202_complete_trigger() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v text;
BEGIN
  IF TG_TABLE_NAME='FoundationStatementVersion' THEN
    PERFORM f202_assert_complete(NEW.id, true);
  ELSIF TG_TABLE_NAME='FoundationStatement' THEN
    FOR v IN SELECT id FROM "FoundationStatementVersion" WHERE "statementId"=NEW.id LOOP
      PERFORM f202_assert_complete(v);
    END LOOP;
  ELSIF TG_TABLE_NAME='FoundationStatementSubject' THEN
    IF TG_OP='DELETE' THEN v:=OLD."statementVersionId"; ELSE v:=NEW."statementVersionId"; END IF;
    PERFORM f202_assert_complete(v);
  ELSE
    IF TG_OP='DELETE' THEN v:=OLD."outputVersionId"; ELSE v:=NEW."outputVersionId"; END IF;
    PERFORM f202_assert_complete(v);
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER f202_complete AFTER INSERT ON "FoundationStatementVersion" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION f202_complete_trigger();
CREATE CONSTRAINT TRIGGER f202_complete AFTER UPDATE ON "FoundationStatement" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION f202_complete_trigger();
CREATE CONSTRAINT TRIGGER f202_complete AFTER INSERT OR DELETE ON "FoundationStatementSubject" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION f202_complete_trigger();
CREATE CONSTRAINT TRIGGER f202_complete AFTER INSERT OR DELETE ON "FoundationSupport" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION f202_complete_trigger();

COMMIT;
