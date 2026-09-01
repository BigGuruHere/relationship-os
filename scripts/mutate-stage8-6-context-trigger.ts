// PURPOSE: Behaviourally mutation-test the Stage 8.6 missing-custody database trigger.
// SAFETY: The vulnerable trigger function and all temporary data exist only inside one transaction,
// then an intentional error rolls the entire transaction back. Never run this against production.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ROLLBACK_MARKER = 'STAGE86_MUTATION_ROLLBACK';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the Stage 8.6 trigger mutation test in production.');
  }
  if (process.env.ALLOW_STAGE86_MUTATION_TEST !== 'true') {
    throw new Error('Set ALLOW_STAGE86_MUTATION_TEST=true to run the transactional Stage 8.6 trigger mutation test.');
  }

  let mutationWasObservable = false;

  try {
    await prisma.$transaction(async (tx) => {
      // SECURITY MUTATION: Deliberately restore the unsafe pre-fix behaviour inside this transaction.
      // The transaction is always rolled back, so this definition must never persist after the test.
      await tx.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION "relish_enforce_context_owner"() RETURNS trigger AS $$
        DECLARE context_owner TEXT;
        BEGIN
          IF NEW."contextSpaceId" IS NULL OR NEW."contextSpaceId" = '00000000-0000-0000-0000-000000000000' THEN
            NEW."contextSpaceId" := NEW."userId";
          END IF;
          SELECT "ownerUserId" INTO context_owner FROM "ContextSpace" WHERE "id" = NEW."contextSpaceId";
          IF context_owner IS NULL THEN
            RAISE EXCEPTION 'ContextSpace % does not exist', NEW."contextSpaceId";
          END IF;
          IF context_owner <> NEW."userId" THEN
            RAISE EXCEPTION 'ContextSpace % is not owned by user %', NEW."contextSpaceId", NEW."userId";
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      const userId = `stage86-mutation-${randomUUID()}`;
      const contactId = randomUUID();

      // IT: Creating the User also creates its deterministic default ContextSpace via the 8.6 trigger.
      await tx.user.create({ data: { id: userId } });

      // MUTATION EXPECTATION: With the vulnerable function installed, omitting contextSpaceId is
      // silently converted to userId. If this does not succeed, the intended mutation was not active.
      await tx.$executeRawUnsafe(
        // IT: Raw SQL bypasses Prisma's @updatedAt handling, so provide updatedAt explicitly.
        // All other required Contact fields either appear here or have database defaults.
        'INSERT INTO "Contact" ("id", "userId", "fullNameEnc", "fullNameIdx", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)',
        contactId,
        userId,
        'stage86-mutation-contact',
        `stage86-mutation-${contactId}`
      );

      const row = await tx.contact.findUnique({
        where: { id: contactId },
        select: { userId: true, contextSpaceId: true }
      });
      assert.equal(row?.userId, userId);
      assert.equal(row?.contextSpaceId, userId);
      mutationWasObservable = true;

      // SAFETY: Force rollback of the function mutation and all temporary rows.
      throw new Error(ROLLBACK_MARKER);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK_MARKER) throw error;
  }

  assert.equal(mutationWasObservable, true, 'The deliberately vulnerable trigger mutation was not observable.');

  // IT: After rollback, prove the installed production function no longer contains the unsafe assignment.
  const rows = await prisma.$queryRawUnsafe<Array<{ definition: string }>>(
    `SELECT pg_get_functiondef('relish_enforce_context_owner()'::regprocedure) AS definition`
  );
  const definition = rows[0]?.definition || '';
  assert.doesNotMatch(definition, /NEW\."contextSpaceId"\s*:=\s*NEW\."userId"/);
  assert.match(definition, /requires explicit contextSpaceId/);
  assert.match(definition, /cannot use the default ContextSpace sentinel/);

  console.log('PASS: Stage 8.6 trigger mutation was observable and the transaction rolled back to the fail-closed trigger.');
}

main()
  .catch((error) => {
    console.error('FAIL: Stage 8.6 trigger mutation check failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
