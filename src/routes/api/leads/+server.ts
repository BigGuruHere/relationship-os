// src/routes/api/leads/+server.ts
// PURPOSE:
// - Capture a new lead, create a Contact under the owner tenant, and send a magic link
// MULTI TENANT:
// - Contact is created with owner userId
// SECURITY:
// - PII is encrypted on the server using your existing helpers
// ENV AWARE:
// - Pass locals.appOrigin to sendMagicLink so the email contains a correct absolute URL per environment

import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { verifyInviteToken } from '$lib/server/tokens';
import { sendMagicLink } from '$lib/server/magic';

export const POST: RequestHandler = async ({ request, locals }) => {
  // Parse body - expects inviteToken plus at least one of email or phone
  const { inviteToken, name, email, phone, textMe } = await request.json();

  // Validate minimal inputs
  if (!inviteToken || (!email && !phone)) {
    return new Response(JSON.stringify({ error: 'Invite and at least one contact field is required' }), { status: 400 });
  }

  // Verify invite and resolve the owner
  const invite = await verifyInviteToken(inviteToken);
  if (!invite) {
    return new Response(JSON.stringify({ error: 'Invalid or expired invite' }), { status: 400 });
  }

  // Build encrypted contact payload
  const data: any = {
    userId: invite.ownerId,
    fullNameEnc: encrypt((name || '').trim() || 'New contact', 'contact.full_name'),
    fullNameIdx: buildIndexToken((name || '').trim() || 'New contact')
  };
  if (email) {
    data.emailEnc = encrypt(String(email).trim(), 'contact.email');
    data.emailIdx = buildIndexToken(String(email).trim());
  }
  if (phone) {
    data.phoneEnc = encrypt(String(phone).trim(), 'contact.phone');
    data.phoneIdx = buildIndexToken(String(phone).trim());
  }

  // Create the Contact - tolerate duplicate email index by falling back to a lookup
  let contactId: string | null = null;
  try {
    const created = await prisma.contact.create({ data, select: { id: true } });
    contactId = created.id;
  } catch (err: any) {
    // If unique constraint on emailIdx, try to find the existing contact and proceed
    if (err?.code === 'P2002' && Array.isArray(err?.meta?.target) && err.meta.target.includes('emailIdx') && email) {
      const found = await prisma.contact.findFirst({
        where: { userId: invite.ownerId, emailIdx: buildIndexToken(String(email).trim()) },
        select: { id: true }
      });
      contactId = found?.id || null;
    } else {
      console.error('[lead] failed to create contact', err);
    }
  }

  // Decide destination for the magic link
  // - Prefer email if provided
  // - If textMe is true and phone is present, use phone for an SMS flow your sender supports
  const destination = (email && String(email).trim()) || (textMe && phone && String(phone).trim()) || null;

  if (destination) {
    // Ensure a guest user exists to own the session created by the magic link
    // - If you later key by email, you can upsert here. For now we create a guest user.
    const guest = await prisma.user.create({
      data: { role: 'guest' }
    });

    // Send the magic link with env-aware origin so the URL is correct on local, dev, and prod
    // - Next step will update sendMagicLink to accept { origin } and build the URL accordingly
    await sendMagicLink({ userId: guest.id, to: destination, origin: locals.appOrigin });
  }

  return new Response(JSON.stringify({ ok: true, contactId }), { status: 200 });
};
