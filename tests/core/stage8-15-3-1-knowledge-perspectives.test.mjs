// IT: Source-level regression checks. Live Prisma/schema drift validation is separate.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('legacy data receives an unspecified perspective, not an invented attribution', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20261013180000_stage8_15_3_1_knowledge_perspectives/migration.sql');
  assert.match(schema, /perspective KnowledgePerspective @default\(UNSPECIFIED_LEGACY\)/);
  assert.match(migration, /DEFAULT 'UNSPECIFIED_LEGACY'/);
});
test('the note form submits a perspective with the claim', () => {
  assert.match(read('src/routes/contacts/[id]/interactions/[iid]/+page.svelte'), /name="perspective" bind:value=\{capturePerspective\}/);
  assert.match(read('src/routes/contacts/[id]/interactions/[iid]/+page.server.ts'), /perspective: form\.get\('perspective'\)/);
});
test('claim reconciliation treats two perspectives as distinct', () => {
  const core = read('src/lib/server/core/knowledge.ts');
  assert.match(core, /perspective: perspective as any,[\s\S]*?status: 'ACTIVE'/);
  assert.match(core, /perspectiveLabel: knowledgePerspectiveLabel/);
});
