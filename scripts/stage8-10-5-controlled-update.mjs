// PURPOSE: Apply npm-compatible fixes without forced major changes or automatic production deployment.
// SAFETY: This changes package.json/package-lock.json locally. Review git diff before committing.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';

const confirm = process.env.ALLOW_RELISH_DEPENDENCY_UPDATE === 'YES';
if (!confirm) {
  console.error('Explicit opt-in required: ALLOW_RELISH_DEPENDENCY_UPDATE=YES npm run security:stage8.10.5:update');
  process.exit(2);
}
if (!existsSync('package-lock.json')) throw new Error('Run from the project root (package-lock.json missing).');
mkdirSync('security-reports', { recursive: true });
const backup = `security-reports/package-lock.before-stage8-10-5.json`;
copyFileSync('package-lock.json', backup);
console.log('Backed up the old lockfile to', backup);
function run(label, command, args) {
  console.log(`\n${label}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
// npm update respects the existing major-version ranges in package.json.
// SvelteKit is built into the production server despite being in devDependencies.
const first = run('Refresh compatible framework/build versions', 'npm', ['update', '@sveltejs/kit', '@sveltejs/adapter-node', '@sveltejs/vite-plugin-svelte', 'svelte', 'vite']);
if (first !== 0) {
  console.error('npm update did not succeed; inspect output. Existing backup is preserved.');
  process.exit(first);
}
// npm audit fix without --force avoids deliberate out-of-range downgrades such as prisma@6.12.
const fix = run('Apply compatible audit fixes', 'npm', ['audit', 'fix']);
if (fix !== 0) console.warn('Some advisories remain or npm audit failed. Inspect the generated report; do not force-upgrade Prisma.');
run('Generate Prisma client', 'npx', ['prisma', 'generate']);
run('Write post-update audit reports', 'npm', ['run', 'audit:stage8.10.4']);
console.log('Review package.json/package-lock.json changes and run the verification suite in STAGE8_10_5_CONTROLLED_SECURITY_UPDATE.md.');
// Leave nonzero audit reporting to the dedicated verification step so residual Prisma alerts are visible.
