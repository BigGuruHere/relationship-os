// scripts/check-stage8-2-provenance.ts
// PURPOSE: Read-only post-migration integrity checks for Stage 8.2.

import { prisma } from '../src/lib/db.ts';

async function main() {
  const [wantMissing, offerMissing, introBadSides, participantTenantMismatch, outcomeTenantMismatch] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "Want" WHERE "authority" IS NULL OR "sourceType" IS NULL`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "Offer" WHERE "authority" IS NULL OR "sourceType" IS NULL`,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM (
        SELECT i."id"
        FROM "Introduction" i
        LEFT JOIN "IntroductionParticipant" p ON p."introductionId" = i."id"
        GROUP BY i."id"
        HAVING count(p."id") <> 2
      ) bad
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM "IntroductionParticipant" p
      JOIN "Introduction" i ON i."id" = p."introductionId"
      WHERE p."userId" <> i."userId"
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM "Outcome" o
      JOIN "Introduction" i ON i."id" = o."introductionId"
      WHERE o."userId" <> i."userId"
    `
  ]);

  const values = {
    wantMissing: Number(wantMissing[0]?.count || 0n),
    offerMissing: Number(offerMissing[0]?.count || 0n),
    introBadSides: Number(introBadSides[0]?.count || 0n),
    participantTenantMismatch: Number(participantTenantMismatch[0]?.count || 0n),
    outcomeTenantMismatch: Number(outcomeTenantMismatch[0]?.count || 0n)
  };

  console.log('Stage 8.2 provenance/introduction integrity:', values);
  if (Object.values(values).some((value) => value !== 0)) {
    throw new Error('FAIL: Stage 8.2 integrity check found inconsistent rows.');
  }
  console.log('PASS: Stage 8.2 provenance and introduction/outcome data is internally consistent.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
