// tests/core/stage8-5-2-agent-access-hardening.test.ts
// PURPOSE: Behaviourally verify fail-closed policy-built entity reads and tenant-scoped repository predicates.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildCompanyEntitySelect,
  buildContactEntitySelect,
  buildDealEntitySelect,
  buildProjectEntitySelect
} from '../../src/lib/server/core/agentEntitySelection.ts';
import { createScopedRelationshipRepository } from '../../src/lib/server/core/scopedRepository.ts';

const readTool = readFileSync('src/lib/server/agents/tools/readEntityContext.ts', 'utf8');
const access = readFileSync('src/lib/server/core/agentDataAccess.ts', 'utf8');
const projection = readFileSync('src/lib/server/core/agentEntityProjection.ts', 'utf8');
const retirement = readFileSync('STAGE8_0_RETIREMENT_REGISTER.md', 'utf8');

const basePolicy = {
  allowContacts: true,
  allowCompanies: true,
  allowDeals: true,
  allowProjects: true,
  allowIdentity: true,
  allowContactMethods: true,
  allowInteractions: true,
  allowWants: true,
  allowOffers: true,
  allowRelationships: true,
  allowTasks: true,
  maxRecentInteractions: 8,
  maxWants: 12,
  maxOffers: 12
};

test('contact selection never asks Prisma for denied contact methods, interactions, tasks or relationships', () => {
  const select = buildContactEntitySelect({
    ...basePolicy,
    allowContactMethods: false,
    allowInteractions: false,
    allowTasks: false,
    allowRelationships: false
  });
  assert.equal('emailEnc' in select, false);
  assert.equal('phoneEnc' in select, false);
  assert.equal('linkedinEnc' in select, false);
  assert.equal('interactions' in select, false);
  assert.equal('tasks' in select, false);
  assert.equal('companyLinks' in select, false);
  assert.equal('dealLinks' in select, false);
});

test('deal selection removes nested contact methods before query when policy denies them', () => {
  const select: any = buildDealEntitySelect({ ...basePolicy, allowContactMethods: false });
  const nested = select.contacts.select.contact.select;
  assert.equal('emailEnc' in nested, false);
  assert.equal('phoneEnc' in nested, false);
  assert.equal('linkedinEnc' in nested, false);
  assert.equal('fullNameEnc' in nested, true);
});

test('deal selection does not query counterparties when relationships are denied', () => {
  const select = buildDealEntitySelect({ ...basePolicy, allowRelationships: false });
  assert.equal('contacts' in select, false);
  assert.equal('companies' in select, false);
});

test('company selection does not query employees when contacts are denied', () => {
  const select = buildCompanyEntitySelect({ ...basePolicy, allowContacts: false });
  assert.equal('contacts' in select, false);
});

test('project task selection does not query linked counterparties unless relationship access permits them', () => {
  const select: any = buildProjectEntitySelect({ ...basePolicy, allowRelationships: false });
  const taskSelect = select.tasks.select;
  assert.equal('contact' in taskSelect, false);
  assert.equal('company' in taskSelect, false);
  assert.equal('deal' in taskSelect, false);
});

test('identity denial produces an id-only top-level deal select rather than leaking future fields', () => {
  const select = buildDealEntitySelect({
    ...basePolicy,
    allowIdentity: false,
    allowRelationships: false,
    allowInteractions: false,
    allowTasks: false
  });
  assert.deepEqual(select, { id: true });
});

test('the compatibility tool now delegates to a pre-query Core projection and has no post-query filter', () => {
  assert.match(readTool, /buildAgentEntityContextProjection/);
  assert.doesNotMatch(readTool, /filterEntityContextForAgentPolicy/);
  assert.doesNotMatch(access, /filterEntityContextForAgentPolicy/);
  assert.match(projection, /buildContactEntitySelect\(policy\)/);
  assert.match(projection, /buildCompanyEntitySelect\(policy\)/);
  assert.match(projection, /buildDealEntitySelect\(policy\)/);
  assert.match(projection, /buildProjectEntitySelect\(policy\)/);
});

test('real repository primitive enforces userId for same id lookups', async () => {
  const rows = [
    { id: 'contact-a', userId: 'user-a', contextSpaceId: 'context-a', label: 'A' },
    { id: 'contact-b', userId: 'user-b', contextSpaceId: 'context-b', label: 'B' }
  ];
  const delegate = {
    async findFirst({ where, select }: any) {
      const row = rows.find((candidate) => candidate.id === where.id && candidate.userId === where.userId && candidate.contextSpaceId === where.contextSpaceId) || null;
      if (!row) return null;
      return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, (row as any)[key]]));
    }
  };
  const repo = createScopedRelationshipRepository({
    contact: delegate, company: delegate, deal: delegate, project: delegate, interaction: delegate,
    want: delegate, offer: delegate, objective: delegate, knowledgeClaim: delegate
  });

  assert.deepEqual(await repo.findContact({ workspaceUserId: 'user-a', contextSpaceId: 'context-a' }, 'contact-a', { id: true }), { id: 'contact-a' });
  assert.equal(await repo.findContact({ workspaceUserId: 'user-b', contextSpaceId: 'context-b' }, 'contact-a', { id: true }), null);
  assert.equal(await repo.findContact({ workspaceUserId: 'user-a', contextSpaceId: 'context-a' }, 'contact-b', { id: true }), null);
});

test('tenant predicate also protects Want and KnowledgeClaim repository reads', async () => {
  const rows = [
    { id: 'want-a', userId: 'user-a', contextSpaceId: 'context-a' },
    { id: 'claim-a', userId: 'user-a', contextSpaceId: 'context-a' }
  ];
  const delegate = {
    async findFirst({ where }: any) {
      return rows.find((candidate) => candidate.id === where.id && candidate.userId === where.userId && candidate.contextSpaceId === where.contextSpaceId) || null;
    }
  };
  const repo = createScopedRelationshipRepository({
    contact: delegate, company: delegate, deal: delegate, project: delegate, interaction: delegate,
    want: delegate, offer: delegate, objective: delegate, knowledgeClaim: delegate
  });

  assert.equal((await repo.findWant({ workspaceUserId: 'user-a', contextSpaceId: 'context-a' }, 'want-a', { id: true }))?.id, 'want-a');
  assert.equal(await repo.findWant({ workspaceUserId: 'user-b', contextSpaceId: 'context-b' }, 'want-a', { id: true }), null);
  assert.equal((await repo.findKnowledgeClaim({ workspaceUserId: 'user-a', contextSpaceId: 'context-a' }, 'claim-a', { id: true }))?.id, 'claim-a');
  assert.equal(await repo.findKnowledgeClaim({ workspaceUserId: 'user-b', contextSpaceId: 'context-b' }, 'claim-a', { id: true }), null);
});

test('retirement register names and closes the fail-open post-query filtering authority', () => {
  assert.match(retirement, /read_entity_context.*post-query/i);
  assert.match(retirement, /8\.5\.2/);
  assert.match(retirement, /filterEntityContextForAgentPolicy.*deleted/i);
});
