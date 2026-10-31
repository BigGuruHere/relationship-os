// Durable policy-SMS outbox worker, independent of voice-provider initiation.
// Run --watch in a long-lived Node process, or without --watch for a single pass.
import { setTimeout as sleep } from 'node:timers/promises';
import { prisma } from '../src/lib/db';
import { drainQueuedPolicySms } from '../src/lib/server/core/relishPolicySms';

const watch = process.argv.includes('--watch');
try {
  do {
    const sent = await drainQueuedPolicySms(20);
    // Emit only counts. Never log phone numbers, SMS bodies or consent tokens.
    console.log(`[Relish policy SMS] ${sent} queued message(s) submitted.`);
    if (watch) await sleep(10_000);
  } while (watch);
} finally {
  await prisma.$disconnect();
}
