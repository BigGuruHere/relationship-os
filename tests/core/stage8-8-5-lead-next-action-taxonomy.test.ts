// PURPOSE: Verify Stage 8.8.5 turns MarketLead next action into a reusable Workspace vocabulary.
// SECURITY: Custom labels remain context-scoped, encrypted at rest, and identity/contact fields remain outside quick editing.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_LEAD_NEXT_ACTIONS,
  MAX_LEAD_NEXT_ACTION_LENGTH,
  mergeLeadNextActionOptions,
  normaliseLeadNextActionLabel,
  validateLeadNextActionLabel
} from '../../src/lib/leadNextActions.ts';

test('default next actions stay deliberately small and workflow-oriented', () => {
  assert.deepEqual([...DEFAULT_LEAD_NEXT_ACTIONS], [
    'Initiate contact',
    'Initial follow-up',
    'Await response',
    'Nurture contact',
    'Research / find details',
    'No further action'
  ]);
});

test('free-form actions normalize, validate and deduplicate case-insensitively', () => {
  assert.equal(normaliseLeadNextActionLabel('  Send   information pack  '), 'Send information pack');
  assert.equal(validateLeadNextActionLabel('Send information pack'), 'Send information pack');
  assert.equal(validateLeadNextActionLabel(''), '');
  assert.equal(validateLeadNextActionLabel('x'.repeat(MAX_LEAD_NEXT_ACTION_LENGTH + 1)), null);

  const merged = mergeLeadNextActionOptions(
    ['send information pack', 'Arrange valuation call', 'Initiate contact'],
    'ARRANGE VALUATION CALL'
  );
  assert.equal(merged.filter((value) => value.toLowerCase() === 'initiate contact').length, 1);
  assert.equal(merged.filter((value) => value.toLowerCase() === 'arrange valuation call').length, 1);
  assert.ok(merged.some((value) => value.toLowerCase() === 'send information pack'));
});

test('schema stores custom next-action labels as encrypted ContextSpace-scoped taxonomy', () => {
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
  const block = schema.slice(schema.indexOf('model LeadNextActionOption {'), schema.indexOf('// ---------------------------------------------------------------------------\n// PROJECT AND TASK MODELS'));
  assert.match(block, /userId String/);
  assert.match(block, /contextSpaceId String/);
  assert.match(block, /labelEnc String/);
  assert.match(block, /labelIdx String/);
  assert.doesNotMatch(block, /\blabel\s+String\b/);
  assert.match(block, /@@unique\(\[userId, contextSpaceId, labelIdx\], map: "LeadNextActionOption_user_ctx_label_key"\)/);
  assert.match(schema, /leadNextActionOptions LeadNextActionOption\[\]/);
});

test('migration applies owner and reassignment guards to the new taxonomy', () => {
  const migration = fs.readFileSync('prisma/migrations/20260907144000_stage8_8_5_lead_next_action_options/migration.sql', 'utf8');
  assert.match(migration, /CREATE TABLE "LeadNextActionOption"/);
  assert.match(migration, /LeadNextActionOption_context_owner_guard/);
  assert.match(migration, /relish_enforce_context_owner/);
  assert.match(migration, /LeadNextActionOption_context_reassignment_guard/);
  assert.match(migration, /relish_prevent_context_reassignment/);
});

test('lead page exposes the reusable next-action vocabulary in quick and full edit views', () => {
  const page = fs.readFileSync('src/routes/leads/[id]/+page.svelte', 'utf8');
  assert.match(page, /data\.nextActionOptions/);
  assert.match(page, /nextActionOptions/);
  assert.match(page, /\+ Create new action\.\.\./);
  assert.ok((page.match(/name="nextAction"/g) || []).length >= 1);
});

test('saving a new next action remembers it for future dropdowns', () => {
  const server = fs.readFileSync('src/routes/leads/[id]/+page.server.ts', 'utf8');
  assert.match(server, /loadLeadNextActionOptions\(userId, lead\.nextAction \|\| ''\)/);
  assert.match(server, /validateLeadNextActionLabel\(rawValue\)/);
  assert.match(server, /rememberLeadNextActionOption\(userId, candidate\)/);
  assert.match(server, /validateLeadNextActionLabel\(values\.nextAction\)/);
  assert.match(server, /rememberLeadNextActionOption\(userId, nextAction\)/);
});

test('ContextSpace interceptor treats reusable next-action options as directly scoped data', () => {
  const source = fs.readFileSync('src/lib/server/core/contextSpace.ts', 'utf8');
  assert.match(source, /'LeadNextActionOption'/);
});
