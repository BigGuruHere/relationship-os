// Regression check: operator call monitoring needs read-only findFirst for transcript evidence.
// Keep the named boundary tightly scoped; do not enable writes to Interaction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../../src/lib/server/core/contextSpace.ts', import.meta.url), 'utf8');
const block = code.match(/PILOT_PHONE_REVIEW:\s*\{\s*models:\s*\{([\s\S]*?)\n\s*\}\s*\}/)?.[1];
test('PILOT_PHONE_REVIEW permits read-only Interaction.findFirst for recovery evidence', () => {
 assert.ok(block, 'named custody policy exists');
 const methods = block.match(/Interaction:\s*new Set\(\[([^\]]+)\]\)/)?.[1];
 assert.ok(methods, 'Interaction operations defined');
 assert.match(methods, /'findFirst'/);
 assert.match(methods, /'findMany'/);
 assert.doesNotMatch(methods, /'create'|'update'|'delete'|'upsert'/);
});
test('cross-custody policy still enforces the named operation allowlist', () => {
 assert.match(code, /if \(!allowed\?\.has\(operation\)\)/);
 assert.match(code, /Stage 8\.7 \$\{transition\.reason\} boundary does not permit/);
});
