import { requiredPositiveIntEnv } from '$lib/server/config/requiredEnv';
// src/lib/db.ts
// PURPOSE: Provide one Prisma client and enforce Stage 8.6 custody scoping for context-owned models.
// SECURITY: Context-scoped model reads/writes are narrowed before Prisma executes the query.

import { PrismaClient } from '@prisma/client';
import { currentWorkspaceCustody, scopeContextPrismaArgs } from '$lib/server/core/contextSpace';

function createPrismaClient() {
  const base = new PrismaClient({
    // log: ['query'], // uncomment for local SQL debugging
  });

  return base.$extends({
    name: 'relish-context-space-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scopedArgs = scopeContextPrismaArgs(model, operation, args, currentWorkspaceCustody());
          return query(scopedArgs);
        }
      }
    }
  });
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: AppPrismaClient;
  __keepaliveIntervalId__?: NodeJS.Timeout;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const KEEPALIVE_ENABLED = process.env.DB_KEEPALIVE_ENABLED === 'YES' && process.env.DB_KEEPALIVE_DISABLED !== 'YES';
// Only require an interval when this optional feature is explicitly enabled.
const KEEPALIVE_MINUTES = KEEPALIVE_ENABLED ? requiredPositiveIntEnv('DB_KEEPALIVE_MINUTES') : 0;

// Stage 8.14.2: keepalive is opt-in. An unset environment must allow serverless Neon compute to suspend.
if (KEEPALIVE_ENABLED && !globalForPrisma.__keepaliveIntervalId__) {
  globalForPrisma.__keepaliveIntervalId__ = setInterval(async () => {
    try {
      await prisma.$executeRaw`SELECT 1;`;
      console.log('[keepalive] DB ping sent');
    } catch (err) {
      console.error('[keepalive] DB ping failed:', err);
    }
  }, KEEPALIVE_MINUTES * 60 * 1000);
  // A keepalive must not be the sole reason a finished CLI test remains alive.
  globalForPrisma.__keepaliveIntervalId__.unref();
  console.log(`[keepalive] Enabled - every ${KEEPALIVE_MINUTES} minute(s)`);
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('DB request failed after retries');
}
