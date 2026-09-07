// PURPOSE: Behavioural tests for the fast MarketLead priority stepper added in Stage 8.8.1.
// SECURITY: The server action still scopes the write by userId/context custody; this file tests only the pure 1-5 stepping rule.

import test from 'node:test';
import assert from 'node:assert/strict';
import { stepMarketLeadPriority } from '../../src/lib/leadPriority.ts';

test('lead priority moves exactly one step in either direction', () => {
  assert.equal(stepMarketLeadPriority(3, 1), 4);
  assert.equal(stepMarketLeadPriority(3, -1), 2);
});

test('lead priority cannot move outside the existing 1-5 scale', () => {
  assert.equal(stepMarketLeadPriority(5, 1), 5);
  assert.equal(stepMarketLeadPriority(1, -1), 1);
});
