// scripts/check-stage8-1-identity.ts
// PURPOSE: Read-only post-migration integrity check for Stage 8.1 Person bridging.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function scalar(query: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(query);
  return Number(rows[0]?.count ?? 0n);
}

async function main() {
  const [users, persons, usersMissingPerson, linkedToExistingUsers, linkedMissingPerson, linkedMismatch, orphanLegacyLinks] = await Promise.all([
    prisma.user.count(),
    prisma.person.count(),
    prisma.user.count({ where: { personId: null } }),
    scalar('SELECT COUNT(*)::bigint AS count FROM "Contact" c JOIN "User" u ON u."id" = c."linkedUserId"'),
    scalar('SELECT COUNT(*)::bigint AS count FROM "Contact" c JOIN "User" u ON u."id" = c."linkedUserId" WHERE c."personId" IS NULL'),
    scalar('SELECT COUNT(*)::bigint AS count FROM "Contact" c JOIN "User" u ON u."id" = c."linkedUserId" WHERE c."personId" IS DISTINCT FROM u."personId"'),
    scalar('SELECT COUNT(*)::bigint AS count FROM "Contact" c LEFT JOIN "User" u ON u."id" = c."linkedUserId" WHERE c."linkedUserId" IS NOT NULL AND u."id" IS NULL')
  ]);

  console.log('Stage 8.1 identity integrity');
  console.log({ users, persons, usersMissingPerson, linkedToExistingUsers, linkedMissingPerson, linkedMismatch, orphanLegacyLinks });

  const failures: string[] = [];
  if (usersMissingPerson !== 0) failures.push(`${usersMissingPerson} User record(s) have no Person.`);
  if (persons < users) failures.push(`Person count (${persons}) is below User count (${users}).`);
  if (linkedMissingPerson !== 0) failures.push(`${linkedMissingPerson} linked Contact(s) pointing to existing Users have no Person.`);
  if (linkedMismatch !== 0) failures.push(`${linkedMismatch} linked Contact(s) disagree with the linked User Person.`);

  if (orphanLegacyLinks > 0) {
    console.warn(`Informational: ${orphanLegacyLinks} legacy linkedUserId value(s) point to Users that no longer exist; these are left unmapped rather than guessed.`);
  }

  if (failures.length) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log('PASS: Stage 8.1 identity bridge is internally consistent.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
