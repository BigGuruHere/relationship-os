// src/lib/server/contactDisplay.ts
// PURPOSE: Build safe contact display names from encrypted contact rows.
// SECURITY: Decryption happens server side only.

import { decrypt } from '$lib/crypto';
import { getBestDisplayName } from '$lib/server/names';

type ContactNameRow = {
  id: string;
  fullNameEnc: string | null;
  linkedUserId?: string | null;
};

function isPlaceholderName(name: string | null | undefined) {
  const clean = (name || '').trim().toLowerCase();
  return !clean || clean === 'new connection' || clean === 'relish user';
}

export async function contactDisplayName(row: ContactNameRow) {
  let name = '';
  try {
    name = row.fullNameEnc ? decrypt(row.fullNameEnc, 'contact.full_name') : '';
  } catch {
    name = '';
  }

  if (row.linkedUserId && isPlaceholderName(name)) {
    try {
      name = await getBestDisplayName(row.linkedUserId);
    } catch {
      // IT: keep the encrypted value fallback if profile lookup fails.
    }
  }

  return name || 'Relish user';
}

export async function contactOptionsForRows(rows: ContactNameRow[]) {
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: await contactDisplayName(row)
    }))
  );
}
