import { peopleRouteDomain, foundationPage } from '$lib/server/foundation/peopleRouting';
import { resolveFoundationAccess } from '$lib/server/foundation/policy';
import { searchPeople } from '$lib/server/foundation/subjects';
import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { privatePeopleSpace, requirePeopleAccess } from '$lib/server/core/myPeople';
import { privateContactDetails } from '$lib/server/core/contacts';
export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 200);
  if (await peopleRouteDomain(locals.user.id, '/people') === 'FOUNDATION') {
    const after = url.searchParams.get('after') || undefined;
    if (after && !/^[0-9a-f-]{36}$/i.test(after)) throw error(400, 'Invalid directory page.');
    const page = await foundationPage(async () => searchPeople(await resolveFoundationAccess(locals, 'READ'), q, after));
    return { people: page.items, q, next: page.next, foundation: true };
  }
  if (!(await privatePeopleSpace(locals.user.id))) return { people: [], q, next: null, foundation: false };
  const context = await requirePeopleAccess(locals);
  // Decrypt only this owner's private-home Contacts; encrypted fields cannot support plaintext SQL search.
  const rows = await prisma.contact.findMany({ where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], select: { id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true } });
  const people = rows.map(privateContactDetails).filter(p => !q || [p.name,p.email,p.phone].some(v => v.toLowerCase().includes(q.toLowerCase())));
  return { people, q, next: null, foundation: false };
};
