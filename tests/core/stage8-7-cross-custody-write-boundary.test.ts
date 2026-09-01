// PURPOSE: Behaviourally verify Stage 8.7 explicit cross-custody execution boundaries.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_CONTEXT_SENTINEL,
  contextSpaceIdForOwner,
  currentCrossCustodyTransition,
  currentWorkspaceCustody,
  requireSingleContextSpaceIdForOwner,
  runWithCrossOwnerWorkspaceCustody,
  runWithExternalWorkspaceCustody,
  runWithWorkspaceCustody,
  scopeContextPrismaArgs
} from '../../src/lib/server/core/contextSpace.ts';

const connectionsSource = readFileSync('src/lib/connections.ts', 'utf8');
const leadLinkSource = readFileSync('src/lib/leads/link.ts', 'utf8');
const publicProfileSource = readFileSync('src/routes/u/[slug]/+page.server.ts', 'utf8');
const publicLeadSource = readFileSync('src/routes/u/[slug]/lead/+page.server.ts', 'utf8');
const inviteLeadSource = readFileSync('src/routes/api/leads/+server.ts', 'utf8');

const source = { userId: 'user-a', contextSpaceId: 'context-a' };
const target = { userId: 'user-b', contextSpaceId: 'context-b' };

test('active custody cannot resolve another owners ContextSpace implicitly', () => {
  assert.throws(
    () => contextSpaceIdForOwner(target.userId, source),
    /cross-owner ContextSpace resolution requires an explicit Stage 8\.7 custody boundary/i
  );
});

test('active custody cannot directly read or write another owners contextual records', () => {
  assert.throws(
    () => scopeContextPrismaArgs('Contact', 'findMany', { where: { userId: target.userId } }, source),
    /cross-owner context-scoped Prisma access requires an explicit Stage 8\.7 custody boundary/i
  );
  assert.throws(
    () => scopeContextPrismaArgs('Contact', 'create', {
      data: { userId: target.userId, contextSpaceId: target.contextSpaceId, fullNameEnc: 'x' }
    }, source),
    /cross-owner context-scoped Prisma access requires an explicit Stage 8\.7 custody boundary/i
  );
  assert.throws(
    () => scopeContextPrismaArgs('Contact', 'update', {
      where: { id: 'contact-b', userId: target.userId, contextSpaceId: target.contextSpaceId },
      data: { personId: 'person-b' }
    }, source),
    /cross-owner context-scoped Prisma access requires an explicit Stage 8\.7 custody boundary/i
  );
});

test('nested workspace custody cannot silently impersonate another owner', async () => {
  await runWithWorkspaceCustody(source, async () => {
    await assert.rejects(
      () => runWithWorkspaceCustody(target, async () => 'should-not-run'),
      /cross-owner workspace custody transition requires an explicit Stage 8\.7 cross-custody boundary/i
    );
    assert.deepEqual(currentWorkspaceCustody(), source);
  });
  assert.equal(currentWorkspaceCustody(), null);
});

test('named cross-owner boundary enters only the exact target and restores source custody afterward', async () => {
  await runWithWorkspaceCustody(source, async () => {
    const result = await runWithCrossOwnerWorkspaceCustody(
      {
        sourceUserId: source.userId,
        targetUserId: target.userId,
        targetContextSpaceId: target.contextSpaceId,
        reason: 'PUBLIC_PROFILE_CONNECTION'
      },
      async () => {
        assert.deepEqual(currentWorkspaceCustody(), target);
        assert.deepEqual(currentCrossCustodyTransition(), {
          sourceUserId: source.userId,
          targetUserId: target.userId,
          targetContextSpaceId: target.contextSpaceId,
          reason: 'PUBLIC_PROFILE_CONNECTION'
        });

        const scoped: any = scopeContextPrismaArgs('Contact', 'create', {
          data: { userId: target.userId, contextSpaceId: target.contextSpaceId, fullNameEnc: 'public-only' }
        });
        assert.equal(scoped.data.userId, target.userId);
        assert.equal(scoped.data.contextSpaceId, target.contextSpaceId);

        assert.throws(
          () => scopeContextPrismaArgs('Want', 'findMany', { where: { userId: target.userId } }),
          /PUBLIC_PROFILE_CONNECTION boundary does not permit Want\.findMany/i
        );
        assert.throws(
          () => scopeContextPrismaArgs('Contact', 'delete', { where: { id: 'contact-b', userId: target.userId } }),
          /PUBLIC_PROFILE_CONNECTION boundary does not permit Contact\.delete/i
        );
        assert.throws(
          () => scopeContextPrismaArgs('Contact', 'create', {
            data: {
              userId: target.userId,
              contextSpaceId: target.contextSpaceId,
              fullNameEnc: 'nested-write-attempt',
              tags: { create: { tagId: 'tag-b' } }
            }
          }),
          /does not permit nested write data at tags/i
        );
        return 'allowed';
      }
    );

    assert.equal(result, 'allowed');
    assert.deepEqual(currentWorkspaceCustody(), source);
    assert.equal(currentCrossCustodyTransition(), null);
  });

  assert.equal(currentWorkspaceCustody(), null);
  assert.equal(currentCrossCustodyTransition(), null);
});

test('cross-owner boundary validates source, target, and sentinel custody', async () => {
  await runWithWorkspaceCustody(source, async () => {
    await assert.rejects(
      () => runWithCrossOwnerWorkspaceCustody({
        sourceUserId: 'wrong-user', targetUserId: target.userId, targetContextSpaceId: target.contextSpaceId,
        reason: 'LEAD_CLAIM'
      }, async () => undefined),
      /source does not match the active workspace owner/i
    );

    await assert.rejects(
      () => runWithCrossOwnerWorkspaceCustody({
        sourceUserId: source.userId, targetUserId: target.userId, targetContextSpaceId: DEFAULT_CONTEXT_SENTINEL,
        reason: 'LEAD_CLAIM'
      }, async () => undefined),
      /cannot target the ContextSpace sentinel/i
    );
  });
});

test('external ingress enters one explicit target and cannot be smuggled through an authenticated workspace', async () => {
  const result = await runWithExternalWorkspaceCustody(
    {
      targetUserId: target.userId,
      targetContextSpaceId: target.contextSpaceId,
      reason: 'PUBLIC_LEAD_CAPTURE'
    },
    async () => {
      assert.deepEqual(currentWorkspaceCustody(), target);
      assert.deepEqual(currentCrossCustodyTransition(), {
        sourceUserId: null,
        targetUserId: target.userId,
        targetContextSpaceId: target.contextSpaceId,
        reason: 'PUBLIC_LEAD_CAPTURE'
      });
      assert.throws(
        () => scopeContextPrismaArgs('Contact', 'update', {
          where: { id: 'contact-b', userId: target.userId },
          data: { personId: 'person-b' }
        }),
        /PUBLIC_LEAD_CAPTURE boundary does not permit Contact\.update/i
      );
      return 'captured';
    }
  );
  assert.equal(result, 'captured');
  assert.equal(currentWorkspaceCustody(), null);
  assert.equal(currentCrossCustodyTransition(), null);

  await runWithWorkspaceCustody(source, async () => {
    await assert.rejects(
      () => runWithExternalWorkspaceCustody({
        targetUserId: target.userId,
        targetContextSpaceId: target.contextSpaceId,
        reason: 'PUBLIC_LEAD_CAPTURE'
      }, async () => undefined),
      /external custody ingress cannot run inside an active workspace custody context/i
    );
  });
});

test('compatibility destination resolution fails closed unless the owner has exactly one ContextSpace', async () => {
  const clientFor = (rows: Array<{ id: string }>) => ({
    contextSpace: {
      async findMany() { return rows.slice(0, 2); }
    }
  });

  assert.equal(await requireSingleContextSpaceIdForOwner(clientFor([{ id: 'only-space' }]), 'user-a'), 'only-space');
  await assert.rejects(
    () => requireSingleContextSpaceIdForOwner(clientFor([]), 'user-a'),
    /must have exactly one ContextSpace.*found 0/i
  );
  await assert.rejects(
    () => requireSingleContextSpaceIdForOwner(clientFor([{ id: 'one' }, { id: 'two' }]), 'user-a'),
    /must have exactly one ContextSpace.*found 2/i
  );
});


test('public profile already-connected check stays in the visitors own custody', () => {
  assert.match(publicProfileSource, /userId:\s*visitorUserId,[\s\S]{0,120}linkedUserId:\s*ownerId/);
  assert.doesNotMatch(publicProfileSource, /userId:\s*ownerId,[\s\S]{0,120}linkedUserId:\s*visitorUserId/);
});

test('every known legacy cross-owner or public-ingress flow uses the named Stage 8.7 boundary', () => {
  assert.match(connectionsSource, /runWithCrossOwnerWorkspaceCustody/);
  assert.match(connectionsSource, /reason:\s*'PUBLIC_PROFILE_CONNECTION'/);
  assert.match(connectionsSource, /requireSingleContextSpaceIdForOwner/);

  assert.match(leadLinkSource, /runWithCrossOwnerWorkspaceCustody/);
  assert.match(leadLinkSource, /reason:\s*'LEAD_CLAIM'/);
  assert.match(leadLinkSource, /requireSingleContextSpaceIdForOwner/);

  for (const sourceText of [publicLeadSource, inviteLeadSource]) {
    assert.match(sourceText, /runWithExternalWorkspaceCustody/);
    assert.match(sourceText, /reason:\s*'PUBLIC_LEAD_CAPTURE'/);
    assert.match(sourceText, /requireSingleContextSpaceIdForOwner/);
  }
});
