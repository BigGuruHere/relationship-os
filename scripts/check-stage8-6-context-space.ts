// PURPOSE: Real PostgreSQL verification for Stage 8.6 ContextSpace custody and subject integrity.
// SAFETY: Temporary rows use random ids and are removed in finally blocks.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db.ts';
import { createScopedRelationshipRepository } from '../src/lib/server/core/scopedRepository.ts';
import { DEFAULT_CONTEXT_SENTINEL, runWithWorkspaceCustody } from '../src/lib/server/core/contextSpace.ts';

const scopedTables = [
  'Tag','CompanyTag','LeadSource',
  'Contact','Interaction','Reminder','ContactRelationship','Deal','DealNote','DealContact','DealContactNote',
  'Company','CompanyNote','CompanyContact','CompanyContactNote','DealCompany','CompanyRelationship',
  'Objective','KnowledgeClaim','KnowledgeEvidence','Want','WantNote','Offer','OfferNote','Introduction','IntroductionParticipant','Outcome',
  'MarketLead','MarketLeadNote','Project','ProjectWorkstream','ProjectDeal','ProjectNote','Task',
  'ResearchCandidate','ResearchSource','ContactEnrichment','OpportunityScore','OpportunityScoreFactor',
  'AgentRun','AgentToolCall','ModelInvocation','AgentArtifact','ApprovalRequest'
];

async function expectRejected(label: string, fn: () => Promise<unknown>, pattern: RegExp) {
  let error: unknown = null;
  try { await fn(); } catch (err) { error = err; }
  assert.ok(error, `${label} should have been rejected`);
  assert.match(String((error as any)?.message ?? error), pattern, `${label} failed for an unexpected reason`);
}

async function main() {
  const defaultCount = Number((await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "User" u
    JOIN "ContextSpace" c ON c."id" = u."id" AND c."ownerUserId" = u."id" AND c."isDefault" = true
  `)[0]?.count ?? 0n);
  const userCount = Number(await prisma.user.count());
  assert.equal(defaultCount, userCount, 'Every existing User must have exactly the deterministic default ContextSpace.');

  for (const table of scopedTables) {
    const rows = await prisma.$queryRawUnsafe<Array<{ bad: bigint }>>(
      `SELECT COUNT(*)::bigint AS bad FROM "${table}" r LEFT JOIN "ContextSpace" c ON c."id" = r."contextSpaceId" WHERE r."contextSpaceId" IS NULL OR c."id" IS NULL OR c."ownerUserId" <> r."userId"`
    );
    assert.equal(Number(rows[0]?.bad ?? 0n), 0, `${table} contains invalid ContextSpace ownership.`);
  }

  const userA = randomUUID();
  const userB = randomUUID();
  const contextB = randomUUID();
  let generatedContextId: string | null = null;
  const personA = randomUUID();
  const personB = randomUUID();
  const contactA = randomUUID();
  const contactB = randomUUID();
  const wantA = randomUUID();
  const wantB = randomUUID();
  const claimA = randomUUID();
  const claimB = randomUUID();
  const agentDefinitionId = randomUUID();
  const runA = randomUUID();
  const runB = randomUUID();
  const stepA = randomUUID();
  const stepB = randomUUID();
  const runEntityB = randomUUID();

  try {
    await prisma.person.createMany({ data: [{ id: personA }, { id: personB }] });
    await prisma.user.create({ data: { id: userA, personId: personA } });
    await prisma.user.create({ data: { id: userB } });

    const defaultSpace = await prisma.contextSpace.findUnique({ where: { id: userA } });
    assert.equal(defaultSpace?.ownerUserId, userA);
    assert.equal(defaultSpace?.isDefault, true);

    await prisma.contextSpace.create({ data: { id: contextB, ownerUserId: userA, kind: 'AGENT_RELATIONSHIP', isDefault: false } });

    // IT: Non-default spaces no longer derive ids from their owner. Prisma supplies an independent UUID.
    const generatedContext = await prisma.contextSpace.create({
      data: { ownerUserId: userA, kind: 'OTHER', isDefault: false },
      select: { id: true }
    });
    generatedContextId = generatedContext.id;
    assert.notEqual(generatedContext.id, userA, 'A non-default ContextSpace must not reuse the owner User id.');
    assert.match(generatedContext.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    await prisma.contact.create({ data: { id: contactA, userId: userA, contextSpaceId: userA, personId: personA, fullNameEnc: 'contact-a', fullNameIdx: `ctx86-${contactA}` } });
    await prisma.contact.create({ data: { id: contactB, userId: userA, contextSpaceId: contextB, fullNameEnc: 'contact-b', fullNameIdx: `ctx86-${contactB}` } });
    await prisma.want.create({ data: { id: wantA, userId: userA, contextSpaceId: userA, contactId: contactA, titleEnc: 'want-a' } });
    await prisma.want.create({ data: { id: wantB, userId: userA, contextSpaceId: contextB, contactId: contactB, titleEnc: 'want-b' } });
    await prisma.knowledgeClaim.create({ data: { id: claimA, userId: userA, contextSpaceId: userA, contactId: contactA, personId: personA, kind: 'FACT', statementEnc: 'claim-a', statementIdx: `ctx86-${claimA}` } });
    await prisma.knowledgeClaim.create({ data: { id: claimB, userId: userA, contextSpaceId: contextB, contactId: contactB, kind: 'FACT', statementEnc: 'claim-b', statementIdx: `ctx86-${claimB}` } });

    await prisma.agentDefinition.create({
      data: {
        id: agentDefinitionId, userId: userA, key: `ctx86-${agentDefinitionId}`, name: 'Stage 8.6 isolation agent',
        systemPrompt: 'Stage 8.6 custody verification only.'
      }
    });
    await prisma.agentRun.create({ data: { id: runA, userId: userA, contextSpaceId: userA, agentDefinitionId, status: 'completed' } });
    await prisma.agentRun.create({ data: { id: runB, userId: userA, contextSpaceId: contextB, agentDefinitionId, status: 'completed' } });
    await runWithWorkspaceCustody({ userId: userA, contextSpaceId: userA }, () =>
      prisma.agentStep.create({ data: { id: stepA, agentRunId: runA, stepKey: 'ctx-a', stepName: 'Context A' } })
    );
    await runWithWorkspaceCustody({ userId: userA, contextSpaceId: contextB }, async () => {
      await prisma.agentStep.create({ data: { id: stepB, agentRunId: runB, stepKey: 'ctx-b', stepName: 'Context B' } });
      await prisma.agentRunEntity.create({ data: { id: runEntityB, agentRunId: runB, entityType: 'contact', entityId: contactB, role: 'verification' } });
    });

    const repo = createScopedRelationshipRepository(prisma as any);
    assert.equal((await repo.findContact({ workspaceUserId: userA, contextSpaceId: userA }, contactA, { id: true }))?.id, contactA);
    assert.equal(await repo.findContact({ workspaceUserId: userA, contextSpaceId: contextB }, contactA, { id: true }), null);
    assert.equal(await repo.findContact({ workspaceUserId: userA, contextSpaceId: userA }, contactB, { id: true }), null);
    assert.equal((await repo.findWant({ workspaceUserId: userA, contextSpaceId: contextB }, wantB, { id: true }))?.id, wantB);
    assert.equal(await repo.findWant({ workspaceUserId: userA, contextSpaceId: userA }, wantB, { id: true }), null);
    assert.equal(await repo.findKnowledgeClaim({ workspaceUserId: userA, contextSpaceId: contextB }, claimA, { id: true }), null);

    const hiddenStep = await runWithWorkspaceCustody({ userId: userA, contextSpaceId: userA }, () =>
      prisma.agentStep.findFirst({ where: { id: stepB }, select: { id: true } })
    );
    assert.equal(hiddenStep, null, 'AgentStep from another ContextSpace must be hidden through its parent AgentRun.');

    const hiddenRunEntity = await runWithWorkspaceCustody({ userId: userA, contextSpaceId: userA }, () =>
      prisma.agentRunEntity.findFirst({ where: { id: runEntityB }, select: { id: true } })
    );
    assert.equal(hiddenRunEntity, null, 'AgentRunEntity from another ContextSpace must be hidden through its parent AgentRun.');

    await expectRejected(
      'cross-context AgentRunEntity write',
      () => runWithWorkspaceCustody({ userId: userA, contextSpaceId: userA }, () =>
        prisma.agentRunEntity.create({ data: { agentRunId: runA, entityType: 'contact', entityId: contactB, role: 'bad-cross-context' } })
      ),
      /Cross-context AgentRunEntity link blocked|not accessible to run/i
    );

    await expectRejected(
      'omitted ContextSpace write',
      () => prisma.$executeRawUnsafe(
        'INSERT INTO "Contact" ("id", "userId", "fullNameEnc", "fullNameIdx") VALUES ($1, $2, $3, $4)',
        randomUUID(), userA, 'omitted-context', `ctx86-bad-${randomUUID()}`
      ),
      /cannot use the default ContextSpace sentinel/i
    );

    await expectRejected(
      'null ContextSpace write',
      () => prisma.$executeRawUnsafe(
        'INSERT INTO "Contact" ("id", "userId", "contextSpaceId", "fullNameEnc", "fullNameIdx") VALUES ($1, $2, NULL, $3, $4)',
        randomUUID(), userA, 'null-context', `ctx86-bad-${randomUUID()}`
      ),
      /requires explicit contextSpaceId/i
    );

    await expectRejected(
      'sentinel ContextSpace write',
      () => prisma.$executeRawUnsafe(
        'INSERT INTO "Contact" ("id", "userId", "contextSpaceId", "fullNameEnc", "fullNameIdx") VALUES ($1, $2, $3, $4, $5)',
        randomUUID(), userA, DEFAULT_CONTEXT_SENTINEL, 'sentinel-context', `ctx86-bad-${randomUUID()}`
      ),
      /cannot use the default ContextSpace sentinel/i
    );

    await expectRejected(
      'cross-owner ContextSpace write',
      () => prisma.contact.create({ data: { userId: userA, contextSpaceId: userB, fullNameEnc: 'bad-owner', fullNameIdx: `ctx86-bad-${randomUUID()}` } }),
      /not owned by user/i
    );

    await expectRejected(
      'custody reassignment',
      () => prisma.$executeRawUnsafe(
        'UPDATE "Contact" SET "contextSpaceId" = $1 WHERE "id" = $2',
        contextB, contactA
      ),
      /custody reassignment blocked/i
    );

    await expectRejected(
      'cross-context relationship write',
      () => prisma.want.create({ data: { userId: userA, contextSpaceId: contextB, contactId: contactA, titleEnc: 'bad-cross-context' } }),
      /cross-context reference blocked/i
    );

    await expectRejected(
      'Contact-Person subject mismatch',
      () => prisma.knowledgeClaim.create({ data: { userId: userA, contextSpaceId: userA, contactId: contactA, personId: personB, kind: 'FACT', statementEnc: 'bad-subject', statementIdx: `ctx86-bad-${randomUUID()}` } }),
      /subject mismatch/i
    );

    assert.ok(generatedContextId, 'Generated non-default ContextSpace was not created.');
    console.log('PASS: Stage 8.6 same-owner/different-ContextSpace isolation passed.');
    console.log('PASS: Omitted/null/sentinel custody, owner, reassignment, cross-context reference, AgentRunEntity, and Contact-Person guards rejected invalid writes.');
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } }).catch(() => undefined);
    await prisma.person.deleteMany({ where: { id: { in: [personA, personB] } } }).catch(() => undefined);
  }

  const leftovers = await prisma.user.count({ where: { id: { in: [userA, userB] } } });
  assert.equal(leftovers, 0, 'Stage 8.6 temporary test users were not removed.');
  console.log(`PASS: ${scopedTables.length} custody-scoped tables have valid owner/context mappings and no test rows remain.`);
}

main()
  .catch((error) => {
    console.error('FAIL: Stage 8.6 ContextSpace verification failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
