// My People remains private-home-only for ordinary members.
// Owner-only legacy convenience: include explicitly Personal-tagged Business Contacts
// in the directory without moving custody or exposing their Brokerage notes.
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { privatePeopleSpace, requirePeopleAccess } from '$lib/server/core/myPeople';
import { privateContactDetails } from '$lib/server/core/contacts';
import { listOwnerBusinessContacts } from '$lib/server/core/ownerPeopleOrganiser';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 200);
  const isOwner = locals.user.role === 'owner';
  const privateSpace = await privatePeopleSpace(locals.user.id);
  const privateRows = privateSpace
    ? await (async () => {
        const context = await requirePeopleAccess(locals);
        return prisma.contact.findMany({
          where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, createdAt: true }
        });
      })()
    : [];

  const privatePeople = privateRows.map(row => ({
    ...privateContactDetails(row),
    href: '/people/' + row.id,
    origin: 'Private' as const,
    createdAt: row.createdAt
  }));

  // SECURITY: A non-owner must never receive cross-ContextSpace Contact projections.
  const ownerBusinessPeople = isOwner
    ? (await listOwnerBusinessContacts(locals.user.id, true)).map(row => ({
        id: row.id, name: row.name, email: row.email, phone: row.phone,
        href: row.href, origin: row.origin, createdAt: row.createdAt
      }))
    : [];

  const people = [...privatePeople, ...ownerBusinessPeople]
    .filter(person => !q || [person.name, person.email, person.phone].some(value =>
      value.toLowerCase().includes(q.toLowerCase())
    ))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { people, q, isOwner };
};
