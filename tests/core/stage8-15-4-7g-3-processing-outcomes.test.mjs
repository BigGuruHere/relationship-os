import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('validated NO_CHANGE is a success in all initial and impact paths', () => {
 const code=read('src/lib/server/core/phoneUnderstandingAutomation.ts');
 assert.equal((code.match(/detail:'NO_CHANGE'/g)||[]).length,3);
});
test('worker persists call-scoped outcomes before releasing readiness gate', () => {
 const code=read('scripts/process-stage8-15-4-7f-2-phone-queue.ts');
 assert.match(code,/result\.detail === 'NO_CHANGE' \? 'NO_CHANGE' : 'APPLIED'/);
 assert.match(code,/networkDorianSession\.updateMany/);
 assert.ok(code.indexOf('understandingOutcome: outcome') < code.indexOf("finishPhoneUnderstanding(conversationId, 'READY')"));
 assert.match(code,/understandingOutcome: 'FAILED'/);
});
test('monitor distinguishes no-change from failure and applied revisions',()=>{
 const code=read('src/lib/server/pilotMonitor/conversations.ts');
 assert.match(code,/session\.understandingOutcome === 'NO_CHANGE'/);
 assert.match(code,/session\.understandingOutcome === 'FAILED'/);
 assert.match(code,/applied \? 'APPLIED'/);
});
test('worker warnings are throttled rather than repeated every ten seconds',()=>{
 const code=read('scripts/process-stage8-15-4-7f-2-phone-queue.ts');
 assert.match(code,/lastBlockedReport/);
 assert.match(code,/60 \* 60 \* 1000/);
});
test('migration persists outcome on the specific conversation session',()=>{
 const sql=read('prisma/migrations/20261022160000_stage8_15_4_7g3_phone_learning_outcomes/migration.sql');
 assert.match(sql,/ALTER TABLE "NetworkDorianSession"/);
 assert.match(sql,/"understandingOutcome"/);
});
