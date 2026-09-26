// Explicit opt-in only: real database tests create and clean up development rows.
import { spawnSync } from 'node:child_process';
if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') {
  console.error('Set ALLOW_DATING_DEV_DB_TEST=YES and development-only DATING_TEST_USER_ID / DATING_TEST_CONTEXT_SPACE_ID before test:db.');
  process.exit(1);
}
for (const key of ['DATING_TEST_USER_ID', 'DATING_TEST_CONTEXT_SPACE_ID']) {
  if (!process.env[key]) { console.error(`Missing ${key}`); process.exit(1); }
}
// Each script must independently check the DB is development-only and clean up its own rows.
const scripts = [
  'check-stage8-10-3-dating-db.ts',
  'check-stage8-12-0-1-understanding-db.ts',
  'check-stage8-12-1-relating-db.ts',
  'check-stage8-12-2-person-history-db.ts',
  'check-stage8-12-3-person-knowledge-db.ts'
];
for (const script of scripts) {
  console.log(`Running authorised development DB test: ${script}`);
  const result = spawnSync(process.execPath, ['--env-file=.env', '--import', 'tsx', `scripts/${script}`], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
