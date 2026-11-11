// Reuse the additive migration for disposable Foundation fixtures.
import { readFile } from 'node:fs/promises';
export const luMigrationPath =
	'prisma/migrations/20261111010000_lur2_private_understanding/migration.sql';
export async function applyLuMigration(db) {
	return db.exec(await readFile(luMigrationPath, 'utf8'));
}
