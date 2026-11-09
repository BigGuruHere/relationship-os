// tests/core/promotion-wiring.test.ts
// PURPOSE: Guard the wiring between pure safety policies and the production promotion/tool paths.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('agent tool registry checks approval before tool execution', () => {
  const source = readFileSync('src/lib/server/agents/toolRegistry.ts', 'utf8');
  const approvalBranch = source.indexOf('if (needsApproval)');
  const execution = source.indexOf('await tool.execute(');

  assert.ok(approvalBranch >= 0, 'approval branch must exist');
  assert.ok(execution >= 0, 'tool execution branch must exist');
  assert.ok(approvalBranch < execution, 'approval check must happen before tool execution');
});
