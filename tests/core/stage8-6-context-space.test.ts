// PURPOSE: Behaviourally verify Stage 8.6 owner + ContextSpace custody scoping.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CONTEXT_SCOPED_MODELS, currentWorkspaceCustody, runWithWorkspaceCustody, scopeContextPrismaArgs } from '../../src/lib/server/core/contextSpace.ts';
import { createScopedRelationshipRepository } from '../../src/lib/server/core/scopedRepository.ts';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20260901073000_stage8_6_context_space_custody_foundation/migration.sql', 'utf8');

function delegateFor(rows: any[]) {
  return {
    async findFirst({ where, select }: any) {
      const row = rows.find((candidate) => candidate.id === where.id && candidate.userId === where.userId && candidate.contextSpaceId === where.contextSpaceId) || null;
      if (!row) return null;
      return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, row[key]]));
    }
  };
}

test('runWithWorkspaceCustody keeps custody active while a lazy Prisma-style thenable executes', async () => {
  const expected = { userId: 'user-a', contextSpaceId: 'context-a' };
  let observed: ReturnType<typeof currentWorkspaceCustody> = null;

  // IT: PrismaPromise is lazy, so this thenable deliberately does not execute until it is awaited.
  const lazyThenable: any = {
    then(resolve: (value: string) => void) {
      observed = currentWorkspaceCustody();
      resolve('executed');
    }
  };

  const result = await runWithWorkspaceCustody(expected, () => lazyThenable);
  assert.equal(result, 'executed');
  assert.deepEqual(observed, expected);
  assert.equal(currentWorkspaceCustody(), null, 'Custody must not leak after the callback completes.');
});

test('legacy userId-only read is narrowed to that owner default ContextSpace', () => {
  const args: any = scopeContextPrismaArgs('Contact', 'findMany', { where: { userId: 'user-a' } }, null);
  assert.deepEqual(args.where, { userId: 'user-a', contextSpaceId: 'user-a' });
});


test('context-scoped reads fail closed outside custody when no owner is explicit', () => {
  assert.throws(
    () => scopeContextPrismaArgs('Interaction', 'findMany', { select: { id: true } }, null),
    /requires active workspace custody or an explicit userId in the where clause/i
  );
});

test('context-scoped id-only updates fail closed outside custody', () => {
  assert.throws(
    () => scopeContextPrismaArgs('Contact', 'update', { where: { id: 'contact-a' }, data: { personId: 'person-a' } }, null),
    /requires active workspace custody or an explicit userId in the where clause/i
  );
});

test('background creates require explicit owner plus ContextSpace custody', () => {
  assert.throws(
    () => scopeContextPrismaArgs('Contact', 'create', { data: { fullNameEnc: 'x' } }, null),
    /explicit userId and contextSpaceId on every created row/i
  );
  assert.throws(
    () => scopeContextPrismaArgs('Contact', 'create', { data: { userId: 'user-a', fullNameEnc: 'x' } }, null),
    /explicit userId and contextSpaceId on every created row/i
  );

  const args: any = scopeContextPrismaArgs('Contact', 'create', {
    data: { userId: 'user-a', contextSpaceId: 'context-a', fullNameEnc: 'x' }
  }, null);
  assert.equal(args.data.userId, 'user-a');
  assert.equal(args.data.contextSpaceId, 'context-a');
});

test('background upserts require explicit custody in both lookup and create branches', () => {
  assert.throws(
    () => scopeContextPrismaArgs('Tag', 'upsert', {
      where: { userId: 'user-a', slug: 'example' },
      create: { userId: 'user-a', name: 'Example', slug: 'example' },
      update: {}
    }, null),
    /matching explicit userId and contextSpaceId in both where and create/i
  );

  assert.throws(
    () => scopeContextPrismaArgs('Tag', 'upsert', {
      where: { userId: 'user-a', contextSpaceId: 'context-a', slug: 'example' },
      create: { userId: 'user-a', contextSpaceId: 'context-b', name: 'Example', slug: 'example' },
      update: {}
    }, null),
    /matching explicit userId and contextSpaceId in both where and create/i
  );

  const args: any = scopeContextPrismaArgs('Tag', 'upsert', {
    where: { userId: 'user-a', contextSpaceId: 'context-a', slug: 'example' },
    create: { userId: 'user-a', contextSpaceId: 'context-a', name: 'Example', slug: 'example' },
    update: {}
  }, null);
  assert.equal(args.where.contextSpaceId, 'context-a');
  assert.equal(args.create.contextSpaceId, 'context-a');
});

test('inherited-custody models require an active custody boundary outside requests', () => {
  assert.throws(
    () => scopeContextPrismaArgs('AgentStep', 'findFirst', { where: { id: 'step-a' } }, null),
    /requires an active workspace custody context/i
  );
});

test('active request context narrows id-only reads to owner plus active ContextSpace', () => {
  const args: any = scopeContextPrismaArgs('Contact', 'findFirst', { where: { id: 'contact-1' } }, { userId: 'user-a', contextSpaceId: 'context-b' });
  assert.deepEqual(args.where, { id: 'contact-1', userId: 'user-a', contextSpaceId: 'context-b' });
});

test('same-owner explicit userId inherits the active non-default ContextSpace', () => {
  const args: any = scopeContextPrismaArgs('Want', 'findMany', { where: { userId: 'user-a' } }, { userId: 'user-a', contextSpaceId: 'context-b' });
  assert.equal(args.where.contextSpaceId, 'context-b');
});

test('an explicit different owner is narrowed to that other owners default space', () => {
  const args: any = scopeContextPrismaArgs('Contact', 'findMany', { where: { userId: 'user-b' } }, { userId: 'user-a', contextSpaceId: 'context-a' });
  assert.deepEqual(args.where, { userId: 'user-b', contextSpaceId: 'user-b' });
});

test('a request cannot smuggle a different ContextSpace into a scoped query', () => {
  assert.throws(
    () => scopeContextPrismaArgs('Contact', 'findMany', { where: { userId: 'user-a', contextSpaceId: 'context-b' } }, { userId: 'user-a', contextSpaceId: 'context-a' }),
    /does not match the active custody context/i
  );
});

test('future authorised context switching works by entering that ContextSpace before querying', () => {
  const args: any = scopeContextPrismaArgs('Contact', 'findMany', { where: { userId: 'user-a', contextSpaceId: 'context-b' } }, { userId: 'user-a', contextSpaceId: 'context-b' });
  assert.equal(args.where.contextSpaceId, 'context-b');
});

test('creates inherit the active ContextSpace instead of merely the owner id', () => {
  const args: any = scopeContextPrismaArgs('KnowledgeClaim', 'create', { data: { userId: 'user-a', statementEnc: 'x' } }, { userId: 'user-a', contextSpaceId: 'context-b' });
  assert.equal(args.data.userId, 'user-a');
  assert.equal(args.data.contextSpaceId, 'context-b');
});

test('same user cannot read the same id from another ContextSpace through the Core repository', async () => {
  const rows = [
    { id: 'contact-a', userId: 'user-a', contextSpaceId: 'context-a' },
    { id: 'contact-b', userId: 'user-a', contextSpaceId: 'context-b' }
  ];
  const delegate = delegateFor(rows);
  const repo = createScopedRelationshipRepository({
    contact: delegate, company: delegate, deal: delegate, project: delegate, interaction: delegate,
    want: delegate, offer: delegate, objective: delegate, knowledgeClaim: delegate
  });
  assert.equal((await repo.findContact({ workspaceUserId: 'user-a', contextSpaceId: 'context-a' }, 'contact-a', { id: true }))?.id, 'contact-a');
  assert.equal(await repo.findContact({ workspaceUserId: 'user-a', contextSpaceId: 'context-b' }, 'contact-a', { id: true }), null);
  assert.equal(await repo.findContact({ workspaceUserId: 'user-a', contextSpaceId: 'context-a' }, 'contact-b', { id: true }), null);
});



test('inherited agent and tag tables are narrowed through their context-scoped parents', () => {
  const request = { userId: 'user-a', contextSpaceId: 'context-a' };
  const stepArgs: any = scopeContextPrismaArgs('AgentStep', 'findFirst', { where: { id: 'step-b' } }, request);
  assert.deepEqual(stepArgs.where, { id: 'step-b', run: { userId: 'user-a', contextSpaceId: 'context-a' } });

  const entityArgs: any = scopeContextPrismaArgs('AgentRunEntity', 'findFirst', { where: { id: 'entity-b' } }, request);
  assert.deepEqual(entityArgs.where, { id: 'entity-b', run: { userId: 'user-a', contextSpaceId: 'context-a' } });

  const tagArgs: any = scopeContextPrismaArgs('ContactTag', 'findMany', { where: { assignedBy: 'user' } }, request);
  assert.deepEqual(tagArgs.where, {
    assignedBy: 'user',
    contact: { userId: 'user-a', contextSpaceId: 'context-a' },
    tag: { userId: 'user-a', contextSpaceId: 'context-a' }
  });

  const aliasArgs: any = scopeContextPrismaArgs('TagAlias', 'findFirst', { where: { id: 'alias-b' } }, request);
  assert.deepEqual(aliasArgs.where, { id: 'alias-b', tag: { userId: 'user-a', contextSpaceId: 'context-a' } });

  const embeddingArgs: any = scopeContextPrismaArgs('InteractionEmbedding', 'findFirst', { where: { interactionId: 'interaction-b' } }, request);
  assert.deepEqual(embeddingArgs.where, { interactionId: 'interaction-b', interaction: { userId: 'user-a', contextSpaceId: 'context-a' } });
});

test('schema makes ContextSpace separate from User ownership and adds custody to canonical records', () => {
  assert.match(schema, /model ContextSpace \{/);
  assert.match(schema, /id\s+String @id @default\(uuid\(\)\)/);
  assert.match(schema, /ownerUserId String/);
  for (const model of ['Contact', 'Company', 'Interaction', 'KnowledgeClaim', 'Objective', 'Want', 'Offer', 'Task', 'AgentRun']) {
    const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1] || '';
    assert.match(block, /contextSpaceId String/, `${model} must carry custody context`);
  }
});

test('every direct ContextSpace relation has an inverse relation on ContextSpace', () => {
  const models = new Map<string, string>();
  for (const match of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    models.set(match[1], match[2]);
  }

  const contextSpaceBlock = models.get('ContextSpace') || '';
  const directScopedModels = Array.from(models.entries())
    .filter(([model, body]) => model !== 'ContextSpace' && /\bcontextSpace\s+ContextSpace\b/.test(body))
    .map(([model]) => model);

  const inverseTargets = new Set(
    Array.from(contextSpaceBlock.matchAll(/^\s*\w+\s+(\w+)\[\]/gm), (match) => match[1])
  );
  const missing = directScopedModels.filter((model) => !inverseTargets.has(model));

  assert.equal(directScopedModels.length, 44, 'Stage 8.6 direct ContextSpace model count changed; review inverse relations.');
  assert.deepEqual(missing, []);
});



test('contextSpaceId sentinel defaults use Prisma static string defaults rather than dbgenerated expressions', () => {
  const staticSentinel = '@default("00000000-0000-0000-0000-000000000000")';
  const directContextFields = Array.from(schema.matchAll(/contextSpaceId\s+String\s+([^\n]+)/g));
  assert.equal(directContextFields.length, 44, 'Stage 8.6 direct ContextSpace field count changed; review sentinel defaults.');
  for (const match of directContextFields) {
    assert.match(match[1], /@default\("00000000-0000-0000-0000-000000000000"\)/);
    assert.doesNotMatch(match[1], /dbgenerated/);
  }
  assert.equal(schema.split(staticSentinel).length - 1, 44);
});

test('migration backfills one deterministic default ContextSpace and has no destructive user-data statements', () => {
  assert.match(migration, /SELECT "id", "id", 'WORKSPACE'/);
  assert.match(migration, /UPDATE "Contact" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL/);
  assert.match(migration, /Stage 8\.6 aborted:/);
  // IT: The sentinel default is retained only as a tripwire so omitted legacy writes reach the trigger and fail closed.
  assert.match(migration, /ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000'/);
  assert.doesNotMatch(migration, /\bTRUNCATE\b/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
});

test('migration enforces explicit custody, owner, cross-context reference, and Contact-Person consistency at the database boundary', () => {
  assert.match(migration, /relish_enforce_context_owner/);
  assert.match(migration, /requires explicit contextSpaceId/);
  assert.match(migration, /cannot use the default ContextSpace sentinel/);
  assert.doesNotMatch(migration, /NEW\."contextSpaceId" := NEW\."userId"/);
  assert.match(migration, /relish_enforce_context_reference/);
  assert.match(migration, /relish_enforce_contact_person_subject/);
});


test('context-local metadata models are scoped and context-aware uniqueness replaces owner-only uniqueness', () => {
  for (const model of ['Tag', 'CompanyTag', 'LeadSource']) {
    const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1] || '';
    assert.match(block, /contextSpaceId String/, `${model} must be context-local`);
  }
  assert.match(schema, /@@unique\(\[userId, contextSpaceId, linkedUserId\]\)/);
  assert.match(schema, /@@unique\(\[userId, contextSpaceId, sourceType, externalRef\]\)/);
  assert.match(schema, /@@unique\(\[userId, contextSpaceId, nameIdx\]\)/);
});

test('migration prevents silent custody reassignment and cross-context inherited/polymorphic links', () => {
  assert.match(migration, /relish_prevent_context_reassignment/);
  assert.match(migration, /ContactTag_context_reference_guard/);
  assert.match(migration, /Contact_context_reference_guard/);
  assert.match(migration, /AgentRunEntity_context_reference_guard/);
  assert.match(migration, /relish_enforce_agent_run_entity_context/);
  assert.match(migration, /Unsupported AgentRunEntity entity type/);
  assert.match(migration, /LeadSource/);
});

test('every direct foreign key between context-scoped models has a database context-reference guard', () => {
  const scoped = new Set(CONTEXT_SCOPED_MODELS);
  const relations: Array<{ model: string; field: string; target: string }> = [];

  for (const modelMatch of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const model = modelMatch[1];
    if (!scoped.has(model)) continue;
    for (const line of modelMatch[2].split('\n')) {
      const relation = line.match(/^\s*\w+\s+([A-Za-z_]\w*)(?:\?|\[\])?\s+@relation\([^\n]*fields:\s*\[([^\]]+)\][^\n]*references:\s*\[([^\]]+)\]/);
      if (!relation || !scoped.has(relation[1])) continue;
      const target = relation[1];
      const localFields = relation[2].split(',').map((value) => value.trim());
      for (const field of localFields) relations.push({ model, field, target });
    }
  }

  const guarded = new Set<string>();
  const triggerPattern = /CREATE TRIGGER\s+"[^"]+"\nBEFORE[^\n]+ ON "([^"]+)"\nFOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"\(([^;]+)\);/g;
  for (const trigger of migration.matchAll(triggerPattern)) {
    const table = trigger[1];
    const values = Array.from(trigger[2].matchAll(/'([^']+)'/g), (match) => match[1]);
    for (let index = 0; index < values.length; index += 2) {
      guarded.add(`${table}.${values[index]}->${values[index + 1]}`);
    }
  }

  const missing = relations.filter((relation) => !guarded.has(`${relation.model}.${relation.field}->${relation.target}`));
  assert.equal(relations.length, 111, 'Stage 8.6 expected direct context-scoped foreign-key boundary count changed; review the guard specification.');
  assert.deepEqual(missing, []);
});

test('raw SQL access paths are context-scoped rather than user-only', () => {
  const tags = readFileSync('src/lib/tags.ts', 'utf8');
  const tagSuggestions = readFileSync('src/lib/tag_suggestions.ts', 'utf8');
  const embeddings = readFileSync('src/lib/embeddings.ts', 'utf8');
  const intents = readFileSync('src/lib/server/intentCommon.ts', 'utf8');
  assert.match(tags, /contextSpaceId/);
  assert.match(tagSuggestions, /i\."contextSpaceId" = \$3/);
  assert.match(embeddings, /i\."contextSpaceId" = \$3|i\."contextSpaceId" = \$4/);
  assert.match(intents, /"contextSpaceId" = \$4/);
});
