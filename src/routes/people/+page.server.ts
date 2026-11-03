import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { privatePeopleSpace, requirePeopleAccess } from '$lib/server/core/myPeople';
import { privateContactDetails } from '$lib/server/core/contacts';
export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 200);
  if (!(await privatePeopleSpace(locals.user.id))) return { people: [], q };
  const context = await requirePeopleAccess(locals);
  // Decrypt only this owner's private-home Contacts; encrypted fields cannot support plaintext SQL search.
  const rows = await prisma.contact.findMany({ where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true } });
  const people = rows.map(privateContactDetails).filter(p => !q || [p.name,p.email,p.phone].some(v => v.toLowerCase().includes(q.toLowerCase())));
  return { people, q };
};
