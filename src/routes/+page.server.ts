// PURPOSE: Load contacts and decrypt their names for display on the homepage.
// NOTE: We pass the SAME AAD used during encryption ("contact.full_name").
// src/routes/+page.server.ts

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';

export async function load() {
  // Fetch only what we need.
  const rows = await prisma.contact.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, fullNameEnc: true, createdAt: true }
  });

  // Decrypt on the server; never decrypt in the browser.
  const contacts = rows.map((r) => {
    let name = 'Unknown';
    try {
      name = decrypt(r.fullNameEnc, 'contact.full_name'); // AAD must match writer
    } catch {
      // If decryption fails (e.g., wrong key/AAD), show a safe fallback.
      name = '⚠︎ (name unavailable)';
    }
    return { id: r.id, name, createdAt: r.createdAt };
  });

  return { contacts };
}
