// Owner-only convenience screen for sorting legacy Brokerage Contacts into My People.
// SECURITY: This classification is NOT a ContextSpace move or disclosure permission.
import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { privatePeopleSpace, runWithWorkspaceCustody } from '$lib/server/core/myPeople';
import { privateContactDetails } from '$lib/server/core/contacts';
import { listOwnerBusinessContacts, setOwnerBusinessContactPersonal } from '$lib/server/core/ownerPeopleOrganiser';

function requireOwner(locals: App.Locals): string {
  if (!locals.user) throw redirect(303, '/auth/login');
  // SECURITY: Do not substitute ADMIN/BROKER grants for the actual owner account role.
  if (locals.user.role !== 'owner') throw error(403, 'This organiser is available to owner accounts only.');
  return locals.user.id;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const userId = requireOwner(locals);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 200).toLowerCase();

  const home = await privatePeopleSpace(userId);
  const privateRows = home
    ? await runWithWorkspaceCustody({ userId, contextSpaceId: home.id }, () =>
        prisma.contact.findMany({
          where: { userId, contextSpaceId: home.id },
          select: { id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, createdAt: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
        })
      )
    : [];

  const privateContacts = privateRows.map(row => ({
    ...privateContactDetails(row),
    href: '/people/' + row.id,
    origin: 'Private' as const,
    contextSpaceId: home!.id,
    personal: true,
    createdAt: row.createdAt
  }));

  const businessContacts = await listOwnerBusinessContacts(userId);
  // IT: Search only decrypted projections from this owner's verified spaces.
  const contacts = [...privateContacts, ...businessContacts]
    .filter(person => !q || [person.name, person.email, person.phone]
      .some(value => value.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { contacts, q };
};

export const actions: Actions = {
  toggle: async ({ locals, request }) => {
    const userId = requireOwner(locals);
    const form = await request.formData();
    const contactId = String(form.get('contactId') ?? '').trim();
    const contextSpaceId = String(form.get('contextSpaceId') ?? '').trim();
    const selection = String(form.get('personal') ?? '');
    const q = String(form.get('q') ?? '').trim().slice(0, 200);

    if (!contactId || !contextSpaceId || !['0', '1'].includes(selection)) {
      return fail(400, { error: 'Invalid personal contact selection.' });
    }

    try {
      const updated = await setOwnerBusinessContactPersonal(
        userId, contextSpaceId, contactId, selection === '1'
      );
      if (!updated) return fail(404, { error: 'Business contact not found in your account.' });
    } catch {
      // SECURITY: Do not disclose private Contact details or database information in errors.
      return fail(500, { error: 'Unable to update the contact classification.' });
    }

    // IT: A redirect avoids resubmitting the toggle when the browser refreshes.
    throw redirect(303, '/people/organise' + (q ? '?q=' + encodeURIComponent(q) : ''));
  }
};
