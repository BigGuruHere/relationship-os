// scripts/check-stage8-4-3-knowledge-ux.ts
// PURPOSE: Read-only post-migration verification for Stage 8.4.3 Claim/Evidence status support.

import { prisma } from '../src/lib/db.ts';

async function scalar(sql: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(sql);
  return Number(rows[0]?.count || 0n);
}

async function main() {
  const [orphanEvidence, tenantMismatch, activeClaimsWithoutActiveEvidence] = await Promise.all([
    scalar(`SELECT count(*)::bigint AS count FROM "KnowledgeEvidence" e LEFT JOIN "KnowledgeClaim" c ON c."id" = e."claimId" WHERE c."id" IS NULL`),
    scalar(`SELECT count(*)::bigint AS count FROM "KnowledgeEvidence" e JOIN "KnowledgeClaim" c ON c."id" = e."claimId" WHERE e."userId" <> c."userId"`),
    scalar(`SELECT count(*)::bigint AS count FROM "KnowledgeClaim" c WHERE c."status" = 'ACTIVE' AND NOT EXISTS (SELECT 1 FROM "KnowledgeEvidence" e WHERE e."claimId" = c."id" AND e."userId" = c."userId" AND e."status" = 'ACTIVE')`)
  ]);

  console.log('Stage 8.4.3 Claim/Evidence integrity:', { orphanEvidence, tenantMismatch, activeClaimsWithoutActiveEvidence });
  if (orphanEvidence !== 0 || tenantMismatch !== 0) {
    throw new Error('FAIL: Stage 8.4.3 found orphaned or cross-tenant evidence rows.');
  }
  if (activeClaimsWithoutActiveEvidence > 0) {
    console.warn(`INFO: ${activeClaimsWithoutActiveEvidence} active claim(s) currently have no active evidence. The Workspace will flag these for review.`);
  }
  console.log('PASS: Stage 8.4.3 Claim/Evidence status model is internally consistent.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
