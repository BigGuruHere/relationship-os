// PURPOSE: Collect reproducible, non-mutating npm advisory reports from the lockfile.
// SECURITY: Never print .env or credentials and never run npm audit fix automatically.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const dest = 'security-reports';
mkdirSync(dest, { recursive: true });
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const focus = ['@sveltejs/kit', '@sveltejs/adapter-node', 'vite', 'prisma', '@prisma/client', '@prisma/config'];
const installed = Object.fromEntries(focus.map(name => [name, lock.packages[`node_modules/${name}`]?.version ?? 'not installed']));
const report = [`# Dependency security review`, '', `Recorded: ${new Date().toISOString()}`, '', '## Lockfile versions', '', ...Object.entries(installed).map(([name, ver]) => `- ${name}: ${ver}`), ''];
for (const [label, args] of [['full', ['audit', '--json']], ['runtime-only', ['audit', '--omit=dev', '--json']]]) {
  const result = spawnSync('npm', args, { encoding: 'utf8', timeout: 90000, maxBuffer: 20 * 1024 * 1024 });
  const output = result.stdout ?? '';
  writeFileSync(join(dest, `${label}-npm-audit.json`), output || JSON.stringify({ error: result.error?.message ?? result.stderr ?? 'No audit result' }, null, 2));
  let parsed;
  try { parsed = JSON.parse(output); } catch { /* Network/unparseable audit is not a clean result. */ }
  const counts = parsed?.metadata?.vulnerabilities;
  report.push(`## ${label}`, '', counts
    ? `Reported vulnerabilities: ${JSON.stringify(counts)}. Exit code: ${result.status}.`
    : `INCOMPLETE: npm audit could not return advisory counts. ${result.error?.message || parsed?.message || result.stderr || 'Unknown failure'}`,
    '');
  if (counts) console.log(`${label}: ${JSON.stringify(counts)}`);
  else console.warn(`${label}: audit unavailable. Check security-reports/${label}-npm-audit.json`);
}
report.push('## Review notes', '',
  '- `--omit=dev` is a useful comparison, not proof that developer dependencies never ship to production.',
  '- Inspect the affected version, advisory conditions, deployment build, and code paths before deciding urgency.',
  '- No package updates or migrations are performed by this script.',
  '- Do not commit security-reports without reviewing it first; audit output can contain environment details.', '');
writeFileSync(join(dest, 'README.md'), report.join('\n'));
console.log(`Reports saved under ${dest}/`);
