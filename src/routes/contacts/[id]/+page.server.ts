// src/routes/contacts/[id]/+page.server.ts
// PURPOSE: Load contact and its interactions (we won’t decrypt here; keep MVP simple).

import { prisma } from '$lib/db';

export const load = async ({ params }) => {
  const contact = await prisma.contact.findUnique({
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

  if (!contact) return { notFound: true };
  return { contact };
};
