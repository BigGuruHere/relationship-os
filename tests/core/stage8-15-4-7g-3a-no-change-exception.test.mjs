import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('longitudinal reviewer emits typed no-change, not an ordinary error', () => {
 const code=read('src/lib/server/datingLongitudinalLivingUnderstanding.ts');
 assert.match(code,/export class LivingUnderstandingNoChangeError extends Error/);
 assert.match(code,/if \(!affectedTopics.length && !newTopics.length\) throw new LivingUnderstandingNoChangeError\(\)/);
});
test('phone automation catches only typed no-change and rethrows unrelated failures', () => {
 const code=read('src/lib/server/core/phoneUnderstandingAutomation.ts');
 assert.match(code,/error instanceof LivingUnderstandingNoChangeError/);
 assert.match(code,/throw error;/);
 assert.match(code,/detail:'NO_CHANGE'/);
});
