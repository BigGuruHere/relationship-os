// PURPOSE: Report unresolved advisories after the Mac applies compatible dependency updates.
// SAFETY: Fail closed if audit is unavailable; do not call remaining vulnerabilities fixed.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const root = lock.packages?.[''] || {};
// A manually edited package.json without a regenerated lockfile is not a reproducible release.
for (const group of ['dependencies', 'devDependencies']) {
  for (const [name, spec] of Object.entries(pkg[group] || {})) {
    if (root[group]?.[name] !== spec) throw new Error(`Lockfile root does not match package.json for ${name}. Run npm install first.`);
  }
}
mkdirSync('security-reports', { recursive: true });
let problems = false;
for (const [name, args] of [ ['full', ['audit','--json']], ['omit-dev', ['audit','--omit=dev','--json']] ]) {
  const p = spawnSync('npm',args,{encoding:'utf8',timeout:120000,maxBuffer:24*1024*1024});
  let obj;
  try { obj=JSON.parse(p.stdout); } catch { /* npm offline output is not a successful audit. */ }
  if (!obj?.metadata?.vulnerabilities || !obj?.vulnerabilities) {
    console.error(`${name}: INCOMPLETE audit (network or JSON error):`,p.error?.message || p.stderr || p.stdout);
    problems=true; continue;
  }
  writeFileSync(`security-reports/stage8-10-5-${name}.json`,JSON.stringify(obj,null,2)+'\n');
  const counts=obj.metadata.vulnerabilities;
  console.log(`${name}: ${JSON.stringify(counts)}`);
  const unresolved=Object.entries(obj.vulnerabilities).filter(([,v]) => ['critical','high'].includes(v.severity));
  for (const [pkg,v] of unresolved) {
    const via=(v.via || []).map(x => typeof x==='string'?x:x.name).join(', ');
    const prismaChain=['prisma','@prisma/config','deepmerge-ts','effect'].includes(pkg);
    console.log(`${prismaChain?'REVIEW_PRISMA_CHAIN':'UNRESOLVED'} ${pkg} (${v.severity}) via ${via}`);
    if (!prismaChain) problems=true;
  }
  if (unresolved.length) console.log(`${name}: ${unresolved.length} high/critical affected packages still require review.`);
}
const prismaCli = lock.packages?.['node_modules/prisma']?.version;
const prismaClient=lock.packages?.['node_modules/@prisma/client']?.version;
console.log(`Locked prisma CLI: ${prismaCli}, client: ${prismaClient}`);
if (prismaCli !== prismaClient) { console.error('Prisma CLI and runtime client versions must align.'); problems=true; }
if (problems) process.exitCode=1;
