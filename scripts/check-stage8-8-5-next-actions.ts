// PURPOSE: Real PostgreSQL verification for Stage 8.8.5 reusable lead next-action options.
// SAFETY: Uses a random temporary user and removes it in a finally block.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db.ts';
import { buildScopedIndexToken } from '../src/lib/crypto.ts';
import { DEFAULT_LEAD_NEXT_ACTIONS } from '../src/lib/leadNextActions.ts';
import { loadLeadNextActionOptions, rememberLeadNextActionOption } from '../src/lib/server/leadNextActions.ts';
import { runWithWorkspaceCustody } from '../src/lib/server/core/contextSpace.ts';

async function main() {
  const userId = randomUUID();
  const personId = randomUUID();
  const secondContextSpaceId = randomUUID();
  const customAction = `Send information pack ${randomUUID().slice(0, 8)}`;

  try {
    await prisma.person.create({ data: { id: personId } });
    await prisma.user.create({ data: { id: userId, personId } });

    const defaultSpace = await prisma.contextSpace.findUnique({ where: { id: userId }, select: { id: true } });
    assert.equal(defaultSpace?.id, userId, 'Temporary user should receive the deterministic default ContextSpace.');

    await runWithWorkspaceCustody({ userId, contextSpaceId: userId }, async () => {
      const initial = await loadLeadNextActionOptions(userId);
      for (const label of DEFAULT_LEAD_NEXT_ACTIONS) assert.ok(initial.includes(label));

      await rememberLeadNextActionOption(userId, customAction);
      await rememberLeadNextActionOption(userId, customAction.toUpperCase());

      const loaded = await loadLeadNextActionOptions(userId);
      assert.ok(loaded.includes(customAction), 'Custom next action should be reusable on the next lead load.');

      const labelIdx = buildScopedIndexToken(customAction, 'lead_next_action_option:label');
      const count = await (prisma as any).leadNextActionOption.count({ where: { userId, contextSpaceId: userId, labelIdx } });
      assert.equal(count, 1, 'Case variants must not create duplicate custom options.');
    });

    await prisma.contextSpace.create({
      data: { id: secondContextSpaceId, ownerUserId: userId, kind: 'WORKSPACE', isDefault: false }
    });

    await runWithWorkspaceCustody({ userId, contextSpaceId: secondContextSpaceId }, async () => {
      const otherSpace = await loadLeadNextActionOptions(userId);
      assert.equal(otherSpace.includes(customAction), false, 'Custom next actions must not leak between ContextSpaces of the same owner.');
    });

    console.log('PASS: Stage 8.8.5 next-action taxonomy persists custom options, deduplicates them, and preserves ContextSpace isolation.');
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    await prisma.person.deleteMany({ where: { id: personId } }).catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('FAIL: Stage 8.8.5 next-action verification failed.');
  console.error(error);
  process.exitCode = 1;
});
