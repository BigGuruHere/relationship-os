// PURPOSE: capture a new lead, create a Contact under the owner tenant, and send a magic link.
// MULTI TENANT: contact is created with owner userId.
// SECURITY: PII is encrypted on the server using your existing helpers.

import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { verifyInviteToken } from '$lib/server/tokens';
import { sendMagicLink } from '$lib/server/magic';

export const POST: RequestHandler = async ({ request }) => {
  const { inviteToken, name, email, phone, textMe } = await request.json();

  // Validate
  if (!inviteToken || (!email && !phone)) {
    return new Response(JSON.stringify({ error: 'Invite and at least one contact field is required' }), { status: 400 });
  }

  // Verify invite is valid and get owner
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

  // Create the Contact - if duplicate email idx exists, this will throw P2002 - we can swallow and continue
  let contactId: string | null = null;
  try {
    const created = await prisma.contact.create({ data, select: { id: true } });
    contactId = created.id;
  } catch (err: any) {
    // If email is duplicate, find that contact so we can still proceed
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

  // Find or create a guest user to send a magic link
  // IT: we key by email when available, otherwise phone - if neither, we skip user creation
  let destination = (email && String(email).trim()) || (textMe && phone && String(phone).trim()) || null;

  if (destination) {
    // IT: ensure we have a User row for magic link - guest role
    // If your User has an email field, you can upsert by email. If not, create a bare user with role guest.
    const guest = await prisma.user.create({
      data: { role: 'guest' }
    });

    await sendMagicLink({ userId: guest.id, to: destination });
  }

  return new Response(JSON.stringify({ ok: true, contactId }), { status: 200 });
};
