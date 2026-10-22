// Stage 8.16: explicit retention task. It does not delete private LU or provisional Users.
// Invoke with the correct environment's DATABASE_URL; requires an explicit opt-in switch.
import { prisma } from '../src/lib/db';
const DAY = 24 * 60 * 60 * 1000;
if (process.env.RELISH_PRUNE_PILOT !== 'YES') throw new Error('Set RELISH_PRUNE_PILOT=YES to run retention cleanup.');
const env = process.env.RELISH_PRUNE_PILOT_ENV;
if (!['local','dev','prod'].includes(env || '')) throw new Error('Set RELISH_PRUNE_PILOT_ENV to local, dev or prod.');
try {
  const now = Date.now();
  // Aggregated event history is bounded to 90 days; entry provenance to 180 days.
  const events = await prisma.productEvent.deleteMany({ where: { environment: env,
    occurredAt: { lt: new Date(now - 90 * DAY) } } });
  // Session FK is SET NULL; deleting stale entries never deletes conversation evidence.
  const entries = await prisma.pilotProfileEntry.deleteMany({ where: { environment: env,
    createdAt: { lt: new Date(now - 180 * DAY) } } });
  const browserSessions = await prisma.pilotBrowserSession.deleteMany({ where: {
    OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }]
  } });
  console.log('[Pilot retention]', { environment: env, events: events.count,
    entries: entries.count, expiredBrowserSessions: browserSessions.count });
} finally { await prisma.$disconnect(); }
