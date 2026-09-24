// PURPOSE: Prevent regression to unsafe forced Prisma upgrades or unverified audit success.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const script=readFileSync('scripts/stage8-10-5-controlled-update.mjs','utf8');
test('stage update requires explicit opt-in',()=>{
  const run=spawnSync(process.execPath,['scripts/stage8-10-5-controlled-update.mjs'],{
    env:{...process.env,ALLOW_RELISH_DEPENDENCY_UPDATE:''},encoding:'utf8'
  });
  assert.equal(run.status,2);
  assert.match(run.stderr,/Explicit opt-in required/);
});
test('security update never uses forced audit fixes or automatic deploy',()=>{
  assert.match(script,/\['audit', 'fix'\]/);
  assert.doesNotMatch(script,/['"]audit['"],\s*['"]fix['"],\s*['"]--force['"]/);
  assert.doesNotMatch(script,/migrate['"],\s*['"]deploy/);
});
test('verification fails closed when audit is unavailable and requires lockfile consistency',()=>{
  const check=readFileSync('scripts/stage8-10-5-verify.mjs','utf8');
  assert.match(check,/INCOMPLETE audit/);
  assert.match(check,/Lockfile root does not match/);
  assert.match(check,/prismaCli !== prismaClient/);
});
