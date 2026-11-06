// Build synthetic legacy tables from the checked-out Prisma schema and install the original default-home trigger.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function legacySchemaFixture(schema) {
	const legacy = schema
		.replace(/^(model|enum) Foundation\w+ \{[\s\S]*?^\}/gm, '')
		.replace(/^\s*(?:f202|s402)\w+ Foundation[^\n]+\n/gm, '\n');
	const legacyModels = [...legacy.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
	const directory = await mkdtemp(join(tmpdir(), 'relish-foundation-'));
	try {
		const path = join(directory, 'legacy.prisma');
		await writeFile(path, legacy);
		const legacySql = execFileSync(
			process.execPath,
			[
				'node_modules/prisma/build/index.js',
				'migrate',
				'diff',
				'--from-empty',
				'--to-schema-datamodel',
				path,
				'--script'
			],
			{ encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
		);
		const custody = await readFile(
			'prisma/migrations/20260901073000_stage8_6_context_space_custody_foundation/migration.sql',
			'utf8'
		);
		const defaultTrigger = custody.slice(
			custody.indexOf('CREATE OR REPLACE FUNCTION "relish_create_default_context_for_user"'),
			custody.indexOf('ALTER TABLE "Contact" ADD COLUMN')
		);
		return { legacyModels, legacySql, defaultTrigger };
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}
