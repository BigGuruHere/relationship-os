// scripts/check-stage8-4-knowledge.ts
// PURPOSE: Read-only post-migration verification for the Stage 8.4 interaction/knowledge pipeline.

import { prisma } from '../src/lib/db.ts';

async function scalar(sql: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(sql);
  return Number(rows[0]?.count || 0n);
}

async function main() {
  const [missingInteractionSubjects, personBridgeMismatch, subjectlessClaims, claimsWithoutEvidence, multiTargetClaims, mismatchedTargets, subjectlessObjectives] = await Promise.all([
    scalar(`SELECT count(*)::bigint AS count FROM "Interaction" WHERE "contactId" IS NULL AND "personId" IS NULL AND "companyId" IS NULL`),
    scalar(`SELECT count(*)::bigint AS count FROM "Interaction" i JOIN "Contact" c ON c."id" = i."contactId" AND c."userId" = i."userId" WHERE c."personId" IS NOT NULL AND i."personId" IS DISTINCT FROM c."personId"`),
    scalar(`SELECT count(*)::bigint AS count FROM "KnowledgeClaim" WHERE "contactId" IS NULL AND "personId" IS NULL AND "companyId" IS NULL`),
    scalar(`SELECT count(*)::bigint AS count FROM "KnowledgeClaim" c WHERE NOT EXISTS (SELECT 1 FROM "KnowledgeEvidence" e WHERE e."claimId" = c."id" AND e."userId" = c."userId")`),
    scalar(`SELECT count(*)::bigint AS count FROM "KnowledgeClaim" WHERE num_nonnulls("objectiveId", "wantId", "offerId") > 1`),
    scalar(`SELECT count(*)::bigint AS count FROM "KnowledgeClaim" WHERE ("objectiveId" IS NOT NULL AND "kind"::text <> 'OBJECTIVE') OR ("wantId" IS NOT NULL AND "kind"::text <> 'WANT') OR ("offerId" IS NOT NULL AND "kind"::text <> 'OFFER')`),
    scalar(`SELECT count(*)::bigint AS count FROM "Objective" WHERE "contactId" IS NULL AND "personId" IS NULL AND "companyId" IS NULL`)
  ]);

  const values = { missingInteractionSubjects, personBridgeMismatch, subjectlessClaims, claimsWithoutEvidence, multiTargetClaims, mismatchedTargets, subjectlessObjectives };
  console.log('Stage 8.4 Interaction/Knowledge integrity:', values);
  if (Object.values(values).some((value) => value !== 0)) {
    throw new Error('FAIL: Stage 8.4 interaction/knowledge integrity check found invalid rows.');
  }
  console.log('PASS: Stage 8.4 common Interaction/Knowledge pipeline is internally consistent.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
