// PURPOSE: load only the signed in user's contacts and decrypt names on the server
// NOTE: AAD must match writer exactly

import { prisma } from '$lib/db'
import { decrypt } from '$lib/crypto'
import { redirect } from '@sveltejs/kit'

export async function load({ locals }) {
  // Require login
  if (!locals.user) throw redirect(303, '/auth/login')

  // Tenant scoped query
  const rows = await prisma.contact.findMany({
    where: { userId: locals.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fullNameEnc: true, createdAt: true }
  })

  // Decrypt on the server, never in the browser
  const contacts = rows.map((r) => {
    try {
      const name = decrypt(r.fullNameEnc, 'contact.full_name')
      return { id: r.id, name, createdAt: r.createdAt }
    } catch {
      return { id: r.id, name: '⚠︎ (name unavailable)', createdAt: r.createdAt }
    }
  })

  return { contacts }
}
