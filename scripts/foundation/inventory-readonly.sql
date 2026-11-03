-- F-201: aggregate-only inventory for an explicitly selected, authorised database.
-- Run with a read-only role and psql -X -v ON_ERROR_STOP=1 -f this-file.
-- Supply the connection through the operator's normal secret mechanism, never Git.
-- No personal values, IDs, content, credentials or per-user groups are returned.
-- A missing table/column or timeout is an incomplete inventory, not a zero count.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = public, pg_catalog;

-- Establish structural volume only; no domain migration or data correction occurs.
SELECT 'User' AS entity, count(*) AS rows FROM "User"
UNION ALL SELECT 'Person', count(*) FROM "Person"
UNION ALL SELECT 'Profile', count(*) FROM "Profile"
UNION ALL SELECT 'ContextSpace', count(*) FROM "ContextSpace"
UNION ALL SELECT 'Contact', count(*) FROM "Contact"
UNION ALL SELECT 'Interaction', count(*) FROM "Interaction"
UNION ALL SELECT 'Lead', count(*) FROM "Lead"
UNION ALL SELECT 'Relating', count(*) FROM "Relating"
UNION ALL SELECT 'RelatingParticipant', count(*) FROM "RelatingParticipant"
UNION ALL SELECT 'GovernedUnderstandingScope', count(*) FROM "GovernedUnderstandingScope"
UNION ALL SELECT 'LivingUnderstandingRevision', count(*) FROM "LivingUnderstandingRevision"
UNION ALL SELECT 'LivingUnderstandingTopicVersion', count(*) FROM "LivingUnderstandingTopicVersion"
UNION ALL SELECT 'KnowledgeClaim', count(*) FROM "KnowledgeClaim"
UNION ALL SELECT 'KnowledgeEvidence', count(*) FROM "KnowledgeEvidence";

-- Bucket by fixed, known domain labels only. Do not return custom context names.
SELECT CASE WHEN s."domainKey" = 'private' THEN 'private'
            WHEN s."domainKey" = 'business' THEN 'business'
            ELSE 'other' END AS custody_bucket,
       count(*) AS contacts, count(DISTINCT c."userId") AS owners
FROM "Contact" c JOIN "ContextSpace" s ON s."id" = c."contextSpaceId"
GROUP BY 1 ORDER BY 1;

-- Integrity anomalies must be reviewed; do not repair them in an inventory script.
SELECT 'contact_custody_mismatch' AS metric, count(*) AS rows
FROM "Contact" c LEFT JOIN "ContextSpace" s ON s."id" = c."contextSpaceId"
WHERE s."id" IS NULL OR s."ownerUserId" <> c."userId"
UNION ALL
SELECT 'interaction_custody_mismatch', count(*)
FROM "Interaction" i LEFT JOIN "ContextSpace" s ON s."id" = i."contextSpaceId"
WHERE s."id" IS NULL OR s."ownerUserId" <> i."userId"
UNION ALL
SELECT 'interaction_contact_custody_mismatch', count(*)
FROM "Interaction" i LEFT JOIN "Contact" c ON c."id" = i."contactId"
WHERE i."contactId" IS NOT NULL AND (c."id" IS NULL OR c."userId" <> i."userId" OR c."contextSpaceId" <> i."contextSpaceId")
UNION ALL
SELECT 'contact_linked_account_missing', count(*)
FROM "Contact" c LEFT JOIN "User" u ON u."id" = c."linkedUserId"
WHERE c."linkedUserId" IS NOT NULL AND u."id" IS NULL
UNION ALL
SELECT 'contact_person_account_disagreement', count(*)
FROM "Contact" c JOIN "User" u ON u."id" = c."linkedUserId"
WHERE c."personId" IS NOT NULL AND c."personId" IS DISTINCT FROM u."personId"
UNION ALL
SELECT 'accounts_missing_person_reference', count(*) FROM "User" WHERE "personId" IS NULL
UNION ALL
SELECT 'owners_with_multiple_private_homes', count(*) FROM (
  SELECT "ownerUserId" FROM "ContextSpace"
  WHERE "domainKey" = 'private' AND "kind" = 'WORKSPACE'
  GROUP BY "ownerUserId" HAVING count(*) > 1
) duplicate_homes;

-- This is a legacy identity-link volume, never proof that those links are verified.
SELECT count(*) FILTER (WHERE "linkedUserId" IS NOT NULL) AS contacts_with_account_link,
       count(*) FILTER (WHERE "personId" IS NOT NULL) AS contacts_with_person_link,
       count(*) FILTER (WHERE "sourceProfileId" IS NOT NULL) AS contacts_with_profile_origin
FROM "Contact";

-- Inspect migration outcomes without printing migration names, logs or checksums.
SELECT count(*) AS recorded_migrations,
       count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied,
       count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished,
       count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back
FROM "_prisma_migrations";

-- ROLLBACK ends the read-only snapshot explicitly; there are no mutations to commit.
ROLLBACK;
