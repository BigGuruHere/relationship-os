// src/routes/u/[slug]/lead/+page.server.ts
// PURPOSE: tiny lead-capture flow - creates an owner-scoped Contact and a claimable Lead
// MULTI TENANT: all writes are scoped to the owner's userId resolved from the slug
// SECURITY: encrypts PII server side and uses deterministic HMAC indexes for equality search
// UX: preserves entered values on validation errors and redirects to /thank-you on success

import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';
import { createInviteToken } from '$lib/server/tokens';
import { resolveOwnerFromSlug } from '$lib/server/owner';


// IT: resolve the profile owner by slug and return only fields we actually have


export const load: PageServerLoad = async ({ params }) => {
  const owner = await resolveOwnerFromSlug(params.slug);
  if (!owner) return { status: 404 };

  return {
    owner: {
      id: owner.id,
      slug: owner.publicSlug || params.slug,
      name: owner.displayName || null
    }
  };
};

export const actions: Actions = {
  create: async ({ request, params }) => {
    const owner = await resolveOwnerFromSlug(params.slug);
    if (!owner) {
      return fail(404, { error: 'Owner not found' });
    }

    const fd = await request.formData();
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const phoneRaw = String(fd.get('phone') || '').trim();
    const phone = phoneRaw.replace(/\s+/g, '');

    // IT: build a reusable values object to preserve input on error
    const values = { name, email, phone: phoneRaw };

    // Validation - all compulsory and basic format checks
    const errors: Record<string, string> = {};
    if (!name) errors.name = 'Name is required';
    if (!email) errors.email = 'Email is required';
    if (!phone) errors.phone = 'Phone is required';

    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (phone && !/^[0-9()+\-]{7,}$/.test(phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    if (Object.keys(errors).length > 0) {
      // IT: preserve values and per-field errors - page will re-render with inputs kept
      return fail(400, { errors, values });
    }

    // Build encrypted contact payload scoped to the owner
    const data: any = {
      userId: owner.id,
      fullNameEnc: encrypt(name, 'contact.full_name'),
      fullNameIdx: buildIndexToken(name),
      emailEnc: encrypt(email, 'contact.email'),
      emailIdx: buildIndexToken(email),
      phoneEnc: encrypt(phone, 'contact.phone'),
      phoneIdx: buildIndexToken(phone)
    };

    // Create or find an existing contact in case of unique collisions
    let contactId: string | null = null;
    try {
      const created = await prisma.contact.create({
        data,
        select: { id: true }
      });
      contactId = created.id;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Prefer lookup by emailIdx then phoneIdx within the same owner tenant
        const existingByEmail = await prisma.contact.findFirst({
          where: { userId: owner.id, emailIdx: buildIndexToken(email) },
          select: { id: true }
        });
        if (existingByEmail) {
          contactId = existingByEmail.id;
        } else {
          const existingByPhone = await prisma.contact.findFirst({
            where: { userId: owner.id, phoneIdx: buildIndexToken(phone) },
            select: { id: true }
          });
          if (existingByPhone) contactId = existingByPhone.id;
        }
      } else {
        console.error('lead contact create failed:', err);
        return fail(500, { error: 'Could not save details', values });
      }
    }

    // Create a Lead that we can claim later when this person signs up
    try {
      const hasLeadAPI =
        (prisma as any).lead && typeof (prisma as any).lead.create === 'function';

      if (hasLeadAPI) {
        const emailIdx = buildIndexToken(email);
        const phoneIdx = buildIndexToken(phone);

        const lead = await (prisma as any).lead.create({
          data: {
            ownerId: owner.id,
            contactId: contactId || '',
            emailIdx,
            phoneIdx,
            status: 'PENDING'
          },
          select: { id: true }
        });

        // Optional - create a short lived invite token for follow ups
        try {
          await createInviteToken({
            ownerId: owner.id,
            ttlMinutes: 60,
            meta: { leadId: lead.id, emailIdx }
          });
        } catch (e) {
          console.warn('lead invite token creation failed:', e);
        }
      }
    } catch (e) {
      console.error('lead create failed:', e);
      // Non-fatal - we still captured a contact for the owner
    }

    // Success - redirect to thank-you
    throw redirect(
      303,
      `/thank-you?ref=${encodeURIComponent(owner.publicSlug || params.slug)}`
    );
  }
};
