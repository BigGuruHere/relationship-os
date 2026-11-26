import { setTimeout as sleep } from 'node:timers/promises';
import { prisma } from '../src/lib/db';
import { processDorianFoundationCall } from '../src/lib/server/foundation/dorianCalls';
import { syncFoundationDorianConfigSnapshots } from '../src/lib/server/integrations/elevenlabs/dorianControlPlane';

async function run() {
	const stop = new AbortController();
	process.once('SIGTERM', () => stop.abort());
	process.once('SIGINT', () => stop.abort());
	let nextSync = 0;
	let sync: Promise<void> | undefined;
	while (!stop.signal.aborted) {
		// Refresh in parallel so a console outage cannot pause transcript jobs.
		if (!sync && Date.now() >= nextSync) {
			nextSync = Date.now() + 60_000;
			sync = syncFoundationDorianConfigSnapshots()
				.then(() => {})
				.catch(() => console.warn('[Dorian Foundation] Console snapshot refresh failed.'))
				.finally(() => { sync = undefined; });
		}
		try {
			if (await processDorianFoundationCall()) continue;
		} catch {
			// This shared log must never include transcripts or account identifiers.
			console.error('[Dorian Foundation] Worker iteration failed.');
		}
		await sleep(10_000, undefined, { signal: stop.signal }).catch(() => {});
	}
	await sync;
	await prisma.$disconnect();
}

void run().catch(() => { process.exitCode = 1; });
