// src/lib/db.ts
// PURPOSE: Singleton Prisma client for SvelteKit (avoids hot-reload duplication in dev).

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // log: ['query'], // uncomment for debugging SQL locally
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
