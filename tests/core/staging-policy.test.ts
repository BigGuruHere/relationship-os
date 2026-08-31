// tests/core/staging-policy.test.ts
// PURPOSE: Lock down tenant scoping and approval requirements for AI-staged records.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approvedEnrichmentGroupWhere,
  approvedStagingOwnershipWhere,
  isApprovedForPromotion,
  stagingOwnershipWhere
} from '../../src/lib/server/agents/stagingPolicy.ts';

test('staging ownership requires record id, user id, and agent run id together', () => {
  assert.deepEqual(stagingOwnershipWhere('user-a', 'candidate-1', 'run-7'), {
    id: 'candidate-1',
    userId: 'user-a',
    agentRunId: 'run-7'
  });
});



test('promotion ownership adds APPROVED to the tenant/run predicate', () => {
  assert.deepEqual(approvedStagingOwnershipWhere('user-a', 'candidate-1', 'run-7'), {
    id: 'candidate-1',
    userId: 'user-a',
    agentRunId: 'run-7',
    status: 'APPROVED'
  });
});

test('only APPROVED staged records are eligible for promotion', () => {
  assert.equal(isApprovedForPromotion('APPROVED'), true);
  assert.equal(isApprovedForPromotion('approved'), true);
  assert.equal(isApprovedForPromotion('CANDIDATE'), false);
  assert.equal(isApprovedForPromotion('REJECTED'), false);
  assert.equal(isApprovedForPromotion('APPLIED'), false);
  assert.equal(isApprovedForPromotion(null), false);
});

test('field-level contact assembly only reads approved rows from the same tenant and run', () => {
  assert.deepEqual(approvedEnrichmentGroupWhere('user-a', 'run-7', 'group-3'), {
    userId: 'user-a',
    agentRunId: 'run-7',
    groupKey: 'group-3',
    status: 'APPROVED'
  });
});
