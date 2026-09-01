// PURPOSE: Real PostgreSQL verification for Stage 8.7 cross-custody execution boundaries.
// SAFETY: Uses random temporary users/contacts and removes them in a finally block.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db.ts';
import {
  currentWorkspaceCustody,
  requireSingleContextSpaceIdForOwner,
  runWithCrossOwnerWorkspaceCustody,
  runWithExternalWorkspaceCustody,
  runWithWorkspaceCustody
} from '../src/lib/server/core/contextSpace.ts';

async function expectRejected(label: string, fn: () => Promise<unknown>, pattern: RegExp) {
  let error: unknown = null;
  try { await fn(); } catch (err) { error = err; }
  assert.ok(error, `${label} should have been rejected`);
  assert.match(String((error as any)?.message ?? error), pattern, `${label} failed for an unexpected reason`);
}

async function main() {
  const userA = randomUUID();
  const userB = randomUUID();
  const personA = randomUUID();
  const personB = randomUUID();
  const crossContactId = randomUUID();
  const ingressContactId = randomUUID();
  let secondContextId: string | null = null;

  try {
    await prisma.person.createMany({ data: [{ id: personA }, { id: personB }] });
    await prisma.user.create({ data: { id: userA, personId: personA } });
    await prisma.user.create({ data: { id: userB, personId: personB } });

    const contextA = await requireSingleContextSpaceIdForOwner(prisma as any, userA);
    const contextB = await requireSingleContextSpaceIdForOwner(prisma as any, userB);
    assert.equal(contextA, userA, 'Stage 8.6 default ContextSpace should still equal User.id.');
    assert.equal(contextB, userB, 'Stage 8.6 default ContextSpace should still equal User.id.');

    await runWithWorkspaceCustody({ userId: userA, contextSpaceId: contextA }, async () => {
      await expectRejected(
        'direct cross-owner read',
        () => prisma.contact.findFirst({ where: { userId: userB }, select: { id: true } }),
        /cross-owner context-scoped Prisma access requires an explicit Stage 8\.7 custody boundary/i
      );

      await expectRejected(
        'direct cross-owner create',
        () => prisma.contact.create({
          data: { userId: userB, contextSpaceId: contextB, fullNameEnc: 'blocked', fullNameIdx: `ctx87-${randomUUID()}` }
        }),
        /cross-owner context-scoped Prisma access requires an explicit Stage 8\.7 custody boundary/i
      );

      await expectRejected(
        'nested custody impersonation',
        () => runWithWorkspaceCustody({ userId: userB, contextSpaceId: contextB }, async () => undefined),
        /cross-owner workspace custody transition requires an explicit Stage 8\.7 cross-custody boundary/i
      );

      const created = await runWithCrossOwnerWorkspaceCustody(
        {
          sourceUserId: userA,
          targetUserId: userB,
          targetContextSpaceId: contextB,
          reason: 'PUBLIC_PROFILE_CONNECTION'
        },
        () => prisma.contact.create({
          data: {
            id: crossContactId,
            userId: userB,
            contextSpaceId: contextB,
            fullNameEnc: 'allowed-cross-custody',
            fullNameIdx: `ctx87-${crossContactId}`
          },
          select: { id: true, userId: true, contextSpaceId: true }
        })
      );

      assert.deepEqual(created, { id: crossContactId, userId: userB, contextSpaceId: contextB });
      assert.deepEqual(currentWorkspaceCustody(), { userId: userA, contextSpaceId: contextA }, 'Source custody must be restored.');

      const hiddenFromSource = await prisma.contact.findFirst({ where: { id: crossContactId }, select: { id: true } });
      assert.equal(hiddenFromSource, null, 'Target Contact must remain invisible from source custody after transition.');
    });

    assert.equal(currentWorkspaceCustody(), null, 'Workspace custody must be clear after source callback.');

    const ingress = await runWithExternalWorkspaceCustody(
      { targetUserId: userB, targetContextSpaceId: contextB, reason: 'PUBLIC_LEAD_CAPTURE' },
      () => prisma.contact.create({
        data: {
          id: ingressContactId,
          userId: userB,
          contextSpaceId: contextB,
          fullNameEnc: 'allowed-external-ingress',
          fullNameIdx: `ctx87-${ingressContactId}`
        },
        select: { id: true, userId: true, contextSpaceId: true }
      })
    );
    assert.deepEqual(ingress, { id: ingressContactId, userId: userB, contextSpaceId: contextB });
    assert.equal(currentWorkspaceCustody(), null, 'External ingress must not leak target custody afterward.');

    const secondContext = await prisma.contextSpace.create({
      data: { ownerUserId: userB, kind: 'OTHER', isDefault: false },
      select: { id: true }
    });
    secondContextId = secondContext.id;

    await expectRejected(
      'multi-ContextSpace compatibility destination',
      () => requireSingleContextSpaceIdForOwner(prisma as any, userB),
      /must have exactly one ContextSpace.*found 2/i
    );

    console.log('PASS: Stage 8.7 direct cross-owner reads/writes and nested custody impersonation fail closed.');
    console.log('PASS: Named cross-owner and external ingress boundaries enter only the explicit target and restore custody afterward.');
    console.log('PASS: Legacy compatibility destinations fail closed as soon as an owner has more than one ContextSpace.');
  } finally {
    if (secondContextId) {
      await prisma.contextSpace.deleteMany({ where: { id: secondContextId, ownerUserId: userB } }).catch(() => undefined);
    }
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } }).catch(() => undefined);
    await prisma.person.deleteMany({ where: { id: { in: [personA, personB] } } }).catch(() => undefined);
  }

  const leftovers = await prisma.user.count({ where: { id: { in: [userA, userB] } } });
  assert.equal(leftovers, 0, 'Stage 8.7 temporary users were not removed.');
  console.log('PASS: Stage 8.7 temporary verification rows were removed.');
}

main()
  .catch((error) => {
    console.error('FAIL: Stage 8.7 cross-custody verification failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
