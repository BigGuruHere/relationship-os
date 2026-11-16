import { setTimeout as sleep } from 'node:timers/promises';
import { prisma } from '../src/lib/db';
import { processDorianFoundationCall } from '../src/lib/server/foundation/dorianCalls';

async function run() {
	const stop = new AbortController();
	process.once('SIGTERM', () => stop.abort());
	process.once('SIGINT', () => stop.abort());
	while (!stop.signal.aborted) {
		try {
			if (await processDorianFoundationCall()) continue;
		} catch {
			// This shared log must never include transcripts or account identifiers.
			console.error('[Dorian Foundation] Worker iteration failed.');
		}
		await sleep(10_000, undefined, { signal: stop.signal }).catch(() => {});
	}
	await prisma.$disconnect();
}

void run().catch(() => { process.exitCode = 1; });
