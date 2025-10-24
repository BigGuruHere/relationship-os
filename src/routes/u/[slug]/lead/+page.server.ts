// src/routes/u/[slug]/lead/+page.server.ts
// PURPOSE: tiny lead-capture flow - creates an owner-scoped Contact and a claimable Lead
// MULTI TENANT: all writes are scoped to the owner's userId resolved from the slug
// SECURITY: encrypts PII server side and uses deterministic HMAC indexes for equality search
// UX: after submit redirects back to the public profile with ?thanks=1 so a banner can show

import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';
import { createInviteToken } from '$lib/server/tokens';

// IT: resolve the profile owner by slug and return only fields we actually have
// - Use Profile.slug to get userId and displayName for UI
// - Then fetch User to get id and publicSlug
// - Do not select User.name since that field does not exist
async function resolveOwnerFromSlug(slug: string) {
  // Try profile.slug first so /u/<profile-slug> works
  const prof = await prisma.profile.findFirst({
    where: { slug },
    select: { userId: true, displayName: true, slug: true }
  });

  if (prof) {
    const user = await prisma.user.findUnique({
      where: { id: prof.userId },
      select: { id: true, publicSlug: true }
    });
    if (user) {
      return {
        id: user.id,
        publicSlug: user.publicSlug || null,
        displayName: prof.displayName || null
      };
    }
  }

  // Fallback to user.publicSlug or direct id
  const user = await prisma.user.findFirst({
    where: { OR: [{ publicSlug: slug }, { id: slug }] },
    select: { id: true, publicSlug: true }
  });

  if (user) {
    return {
      id: user.id,
      publicSlug: user.publicSlug || null,
      displayName: null // no profile context in this fallback
    };
  }

  return null;
}

export const load: PageServerLoad = async ({ params }) => {
  const owner = await resolveOwnerFromSlug(params.slug);
  if (!owner) return { status: 404 };

  return {
    owner: {
      id: owner.id,
      slug: owner.publicSlug || params.slug,
      // IT: use profile displayName if available, else null
      name: owner.displayName || null
    }
  };
};

export const actions: Actions = {
  create: async ({ request, params, locals }) => {
    // Public route - no login required
    // Resolve the owner again on the server to avoid trusting hidden fields
    const owner = await resolveOwnerFromSlug(params.slug);
    if (!owner) {
      return fail(404, { error: 'Owner not found' });
    }

    const fd = await request.formData();
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const phone = String(fd.get('phone') || '').trim();

    if (!name) return fail(400, { error: 'Name is required' });

    // Build encrypted contact payload scoped to the owner
    const data: any = {
      userId: owner.id,
      fullNameEnc: encrypt(name, 'contact.full_name'),
      fullNameIdx: buildIndexToken(name)
    };
    if (email) {
      data.emailEnc = encrypt(email, 'contact.email');
      data.emailIdx = buildIndexToken(email);
    }
    if (phone) {
      data.phoneEnc = encrypt(phone, 'contact.phone');
      data.phoneIdx = buildIndexToken(phone);
    }

    // Create or find an existing contact in case of unique collisions
    let contactId: string | null = null;
    try {
      const created = await prisma.contact.create({
        data,
        select: { id: true }
      });
      contactId = created.id;
    } catch (err: any) {
      // If there is a unique index on emailIdx or phoneIdx, try to find the existing contact
      if (err?.code === 'P2002') {
        // Prefer lookup by emailIdx then phoneIdx within the same owner tenant
        if (email) {
          const existingByEmail = await prisma.contact.findFirst({
            where: { userId: owner.id, emailIdx: buildIndexToken(email) },
            select: { id: true }
          });
          if (existingByEmail) contactId = existingByEmail.id;
        }
        if (!contactId && phone) {
          const existingByPhone = await prisma.contact.findFirst({
            where: { userId: owner.id, phoneIdx: buildIndexToken(phone) },
            select: { id: true }
          });
          if (existingByPhone) contactId = existingByPhone.id;
        }
        // If still not found, fall through and let us continue without a contact id
      } else {
        console.error('lead contact create failed:', err);
        return fail(500, { error: 'Could not save details' });
      }
    }

    // Create a Lead that we can claim later when this person signs up
    // Uses deterministic indexes so we can match without decrypting
    try {
      // Some environments may not have the Lead model yet - guard access
      const hasLeadAPI =
        (prisma as any).lead && typeof (prisma as any).lead.create === 'function';

      if (hasLeadAPI) {
        const emailIdx = email ? buildIndexToken(email) : null;
        const phoneIdx = phone ? buildIndexToken(phone) : null;

        const lead = await (prisma as any).lead.create({
          data: {
            ownerId: owner.id,
            contactId: contactId || '', // schema may require a value - if optional, pass null instead
            emailIdx,
            phoneIdx,
            status: 'PENDING'
          },
          select: { id: true }
        });

        // Optionally issue a claim token - you can email or SMS the link to the visitor
        try {
          const invite = await createInviteToken({
            ownerId: owner.id,
            ttlMinutes: 60,
            meta: { leadId: lead.id, emailIdx }
          });
          // TODO - send invite.token via email or SMS to the visitor
          // Example link - `${absoluteUrlFromOrigin(locals.appOrigin, '/auth/magic')}?token=${invite.token}`
        } catch (e) {
          // Do not block the flow if token creation fails
          console.warn('lead invite token creation failed:', e);
        }
      }
    } catch (e) {
      console.error('lead create failed:', e);
      // Non-fatal - we still captured a contact for the owner
    }

// Redirect to a dedicated thank you page that invites the visitor to create their own profile
// IT: include the sharer slug as a ref so the page can say "You are now connected with <name>"
throw redirect(
    303,
    `/thank-you?ref=${encodeURIComponent(owner.publicSlug || params.slug)}`
  );
  
  }
};
