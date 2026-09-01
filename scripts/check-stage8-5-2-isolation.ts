// scripts/check-stage8-5-2-isolation.ts
// PURPOSE: Real transactional database check for tenant isolation through the production scoped repository primitive.
// SAFETY: Test rows are created and deleted inside one transaction; a failure rolls the transaction back.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createWorkspaceCoreAccess } from '../src/lib/server/core/accessPolicy.ts';
import { createScopedRelationshipRepository } from '../src/lib/server/core/scopedRepository.ts';

const prisma = new PrismaClient();

const tag = randomUUID();
const userA = `stage852-a-${tag}`;
const userB = `stage852-b-${tag}`;
const contactA = `stage852-contact-a-${tag}`;
const contactB = `stage852-contact-b-${tag}`;
const wantA = `stage852-want-a-${tag}`;
const claimA = `stage852-claim-a-${tag}`;

let assertions = 0;

try {
  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({ data: [{ id: userA }, { id: userB }] });
    await tx.contact.createMany({
      data: [
        { id: contactA, userId: userA, contextSpaceId: userA, fullNameEnc: `test-${tag}-a`, fullNameIdx: `test-${tag}-a` },
        { id: contactB, userId: userB, contextSpaceId: userB, fullNameEnc: `test-${tag}-b`, fullNameIdx: `test-${tag}-b` }
      ]
    });
    await tx.want.create({ data: { id: wantA, userId: userA, contextSpaceId: userA, titleEnc: `test-${tag}` } });
    await tx.knowledgeClaim.create({
      data: {
        id: claimA,
        userId: userA,
        // SECURITY: Stage 8.6 no longer permits implicit custody on context-scoped writes.
        contextSpaceId: userA,
        kind: 'FACT',
        statementEnc: `test-${tag}`,
        statementIdx: `test-${tag}`,
        contactId: contactA
      }
    });

    const repo = createScopedRelationshipRepository(tx as any);
    const accessA = createWorkspaceCoreAccess(userA, 'stage8.5.2-isolation-check');
    const accessB = createWorkspaceCoreAccess(userB, 'stage8.5.2-isolation-check');

    assert.equal((await repo.findContact(accessA, contactA, { id: true }))?.id, contactA); assertions++;
    assert.equal(await repo.findContact(accessB, contactA, { id: true }), null); assertions++;
    assert.equal(await repo.findContact(accessA, contactB, { id: true }), null); assertions++;

    assert.equal((await repo.findWant(accessA, wantA, { id: true }))?.id, wantA); assertions++;
    assert.equal(await repo.findWant(accessB, wantA, { id: true }), null); assertions++;

    assert.equal((await repo.findKnowledgeClaim(accessA, claimA, { id: true }))?.id, claimA); assertions++;
    assert.equal(await repo.findKnowledgeClaim(accessB, claimA, { id: true }), null); assertions++;

    // IT: Clean up before commit. Any thrown assertion/error also rolls the transaction back automatically.
    await tx.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  console.log(`PASS: Stage 8.5.2 real repository isolation passed ${assertions} behavioural assertions.`);
  console.log('PASS: Transaction completed with no Stage 8.5.2 test rows retained.');
} finally {
  await prisma.$disconnect();
}
