// src/lib/contacts/view.ts
// PURPOSE: map raw Contact rows to view models with a live name fallback when linkedUserId exists
// SECURITY: decryption happens server side only - no plaintext leaves the server unless intended

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { getBestDisplayName } from '$lib/server/names';

function isPlaceholderName(name: string | null | undefined) {
  const s = (name || '').trim().toLowerCase();
  return !s || s === 'new connection' || s === 'relish user';
}

type ContactView = {
  id: string;
  displayName: string;
  linkedUserId: string | null;
  // IT: add any other fields your UI expects
};

export async function mapContactsForView(userId: string): Promise<ContactView[]> {
  // IT: fetch only what you need for the list
  const rows = await prisma.contact.findMany({
    where: { userId },
    select: {
      id: true,
      linkedUserId: true,
      fullNameEnc: true
    },
    orderBy: [{ updatedAt: 'desc' }]
  });

  // IT: compute a safe display name for each row
  const result: ContactView[] = [];
  for (const r of rows) {
    const stored = r.fullNameEnc ? decrypt(r.fullNameEnc, 'contact.full_name') : '';
    let display = stored || 'Relish user';

    if (r.linkedUserId && isPlaceholderName(display)) {
      // IT: when linked to another Relish user, prefer their current profile name
      display = await getBestDisplayName(r.linkedUserId);
    }

    result.push({
      id: r.id,
      displayName: display,
      linkedUserId: r.linkedUserId
    });
  }
  return result;
}
