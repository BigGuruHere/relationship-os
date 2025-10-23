// src/routes/u/[slug]/lead/+page.server.ts
// PURPOSE: create a lead - insert Contact for the owner and optional guest user
// SECURITY: encrypt PII on server and tenant-scope by ownerId

import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';
import { absoluteUrlFromOrigin } from '$lib/url';
import { createInviteToken } from '$lib/server/tokens';

export const load: PageServerLoad = async ({ params, locals }) => {
  // IT: resolve owner from profile slug first, else user
  const prof = await prisma.profile.findFirst({
    where: { slug: params.slug },
    select: { userId: true }
  });
  const owner = prof
    ? await prisma.user.findUnique({ where: { id: prof.userId }, select: { id: true, publicSlug: true } })
    : await prisma.user.findFirst({ where: { OR: [{ publicSlug: params.slug }, { id: params.slug }] }, select: { id: true, publicSlug: true } });

  if (!owner) return { status: 404 };

  return { owner: { id: owner.id, slug: owner.publicSlug || params.slug } };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    // IT: read form
    const fd = await request.formData();
    const ownerId = String(fd.get('ownerId') || '');
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const phone = String(fd.get('phone') || '').trim();

    if (!ownerId || !name) return fail(400, { error: 'Name is required' });

    // IT: insert contact for the owner - encrypted with deterministic indexes
    const data: any = {
      userId: ownerId,
      fullNameEnc: encrypt(name, 'contact.full_name'),
      fullNameIdx: buildIndexToken(name)
    };
    if (email) { data.emailEnc = encrypt(email, 'contact.email'); data.emailIdx = buildIndexToken(email); }
    if (phone) { data.phoneEnc = encrypt(phone, 'contact.phone'); data.phoneIdx = buildIndexToken(phone); }

    let contactId = '';
    try {
      const created = await prisma.contact.create({ data, select: { id: true } });
      contactId = created.id;
    } catch (err: any) {
      // IT: ignore duplicate email index collisions and continue to user creation
      if (!(err?.code === 'P2002' && Array.isArray(err?.meta?.target) && err.meta.target.includes('emailIdx'))) {
        console.error('lead contact create failed', err);
        return fail(500, { error: 'Could not save details' });
      }
    }

    // IT: create guest user shell if an email was provided - optional
    if (email) {
      try {
        // IT: upsert a user placeholder if not present - your schema may differ
        await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email }
        });

        // IT: send magic link to let them claim the account and build a profile later
        const invite = await createInviteToken({ ownerId, ttlMinutes: 60 });
        // IT: you would email or SMS the magic link here - omitted for brevity
        // The link target could be /auth/magic?token=...
      } catch (err) {
        console.error('guest user create failed', err);
      }
    }

    // IT: after submit, return to the owner’s profile with a success hint
    const to = absoluteUrlFromOrigin(locals.appOrigin, `/u/${encodeURIComponent(String(params.slug || ''))}?thanks=1`);
    throw redirect(303, to);
  }
};
