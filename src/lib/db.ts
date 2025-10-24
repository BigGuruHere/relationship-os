// src/lib/db.ts
// PURPOSE: Provide a single PrismaClient instance and keep-alive pings in dev
// SECURITY: No PII is logged. Keep SQL logs off unless debugging locally.

import { PrismaClient } from '@prisma/client';

// Reuse one Prisma instance during Vite HMR in dev
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  __keepaliveIntervalId__?: NodeJS.Timer;
};

// Create or reuse Prisma client
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // log: ['query'], // uncomment for local SQL debugging
  });

// Cache the instance on global in dev to prevent multiple clients
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * DEV keep-alive ping
 * - Railway idles the DB after a few minutes of inactivity
 * - A tiny SELECT 1 every few minutes keeps it awake while you code
 * - Guard against multiple timers under Vite HMR by storing the id on global
 */
const KEEPALIVE_MINUTES = Number(process.env.DB_KEEPALIVE_MINUTES ?? '4');

  if (!globalForPrisma.__keepaliveIntervalId__) {
    globalForPrisma.__keepaliveIntervalId__ = setInterval(async () => {
      try {
        // Use a raw ping that is essentially free
        await prisma.$executeRaw`SELECT 1;`;
        console.log('[keepalive] DB ping sent');
      } catch (err) {
        // If the DB is waking up, first ping can fail - not fatal
        console.error('[keepalive] DB ping failed:', err);
      }
    }, KEEPALIVE_MINUTES * 60 * 1000);
    console.log(`[keepalive] Enabled - every ${KEEPALIVE_MINUTES} minute(s)`);
  }


/**
 * Optional: lightweight retry wrapper for transient wakeup errors
 * - Use this for entry points that often hit the DB first
 * - Example: const rows = await withRetry(() => prisma.contact.findMany());
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Backoff: 1s, 2s, 3s
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('DB request failed after retries');
}
