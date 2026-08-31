// tests/core/approval-policy.test.ts
// PURPOSE: Ensure any approval requirement fails closed before an agent tool can enter its execution branch.

import assert from 'node:assert/strict';
import test from 'node:test';
import { needsToolApproval } from '../../src/lib/server/agents/approvalPolicy.ts';

test('tool approval is not required only when all three policy layers allow direct execution', () => {
  assert.equal(needsToolApproval({
    toolRequiresApproval: false,
    definitionRequiresApproval: false,
    permissionRequiresApproval: false
  }), false);
});

test('tool-level approval requirement cannot be overridden', () => {
  assert.equal(needsToolApproval({
    toolRequiresApproval: true,
    definitionRequiresApproval: false,
    permissionRequiresApproval: false
  }), true);
});

test('database tool-definition approval requirement cannot be overridden', () => {
  assert.equal(needsToolApproval({
    toolRequiresApproval: false,
    definitionRequiresApproval: true,
    permissionRequiresApproval: false
  }), true);
});

test('agent-specific permission approval requirement cannot be overridden', () => {
  assert.equal(needsToolApproval({
    toolRequiresApproval: false,
    definitionRequiresApproval: false,
    permissionRequiresApproval: true
  }), true);
});
