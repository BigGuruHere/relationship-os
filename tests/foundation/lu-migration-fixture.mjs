// Reuse the additive migration for disposable Foundation fixtures.
import { readFile } from 'node:fs/promises';
export const luMigrationPath =
	'prisma/migrations/20261111010000_lur2_private_understanding/migration.sql';
export async function applyLuMigration(db) {
	await db.exec(await readFile(luMigrationPath, 'utf8'));
	await db.exec(await readFile('prisma/migrations/20261112070000_lu_failed_stage_review/migration.sql', 'utf8'));
}
