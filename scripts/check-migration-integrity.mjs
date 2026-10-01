// Verifies immutable production-deployed Prisma migration files before packaging or deployment.
// Stage 8.13.0 adds new migrations normally, but every migration in this manifest must remain byte-for-byte unchanged.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const manifestPath = path.join(root, 'prisma', 'migrations', 'production-checksums.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];
for (const [name, expected] of Object.entries(manifest)) {
  const file = path.join(root, 'prisma', 'migrations', name, 'migration.sql');
  if (!fs.existsSync(file)) {
    errors.push(`${name}: deployed migration file is missing`);
    continue;
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (actual !== expected) errors.push(`${name}: checksum changed (expected ${expected}, got ${actual})`);
}
if (errors.length) {
  console.error('Migration integrity check failed:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}
console.log(`PASS ${Object.keys(manifest).length} production-deployed Prisma migrations are byte-for-byte unchanged.`);
