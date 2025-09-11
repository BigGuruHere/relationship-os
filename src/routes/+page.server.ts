// src/routes/+page.server.ts
// NOTE: add comments per your preference. This shows a friendly 500 message if DB is unreachable.

import { prisma } from '$lib/db';

export async function load() {
  try {
    const contacts = await prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, fullNameEnc: true, createdAt: true }
    });
    return { contacts };
  } catch (err) {
    // Log once in server console for debugging
    console.error('Prisma failed to fetch contacts:', err);
    // Return a minimal payload so the page still renders
    return {
      contacts: [],
      error: 'Database connection failed. Check DATABASE_URL (SSL, host, port).'
    };
  }
}
