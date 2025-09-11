// PURPOSE: Load a single contact + interactions and decrypt fields for display.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';

export async function load({ params }) {
  const row = await prisma.contact.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      fullNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      createdAt: true,
      interactions: {
        orderBy: { occurredAt: 'desc' },
        select: { id: true, occurredAt: true, channel: true }
      }
    }
  });

  if (!row) return { notFound: true };

  // Decrypt on the server; guard against errors.
  let name = 'Unknown';
  let email: string | null = null;
  let phone: string | null = null;
  try { name = decrypt(row.fullNameEnc, 'contact.full_name'); } catch {}
  try { email = row.emailEnc ? decrypt(row.emailEnc, 'contact.email') : null; } catch {}
  try { phone = row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : null; } catch {}

  return {
    contact: {
      id: row.id,
      name,
      email,
      phone,
      createdAt: row.createdAt
    },
    interactions: row.interactions
  };
}
