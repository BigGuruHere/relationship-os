// src/routes/contacts/[id]/+page.server.ts
// PURPOSE: load a contact with its tags, and add actions to add or remove tags.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';
import { attachContactTags, detachContactTag } from '$lib/tags';

export async function load({ params }) {
  const row = await prisma.contact.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      fullNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      createdAt: true,
      // Load tags via join
      tags: { select: { tag: { select: { name: true, slug: true } } } },
      // Existing interactions list
      interactions: { orderBy: { occurredAt: 'desc' }, select: { id: true, occurredAt: true, channel: true } }
    }
  });

  if (!row) return { notFound: true };

  // Decrypt PII for display
  let name = 'Unknown';
  let email: string | null = null;
  let phone: string | null = null;
  try { name = decrypt(row.fullNameEnc, 'contact.full_name'); } catch {}
  try { email = row.emailEnc ? decrypt(row.emailEnc, 'contact.email') : null; } catch {}
  try { phone = row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : null; } catch {}

  // Flatten tags
  const tags = row.tags.map((t) => t.tag);

  return {
    contact: { id: row.id, name, email, phone, createdAt: row.createdAt, tags },
    interactions: row.interactions
  };
}

// Actions to add and remove tags on contact
export const actions = {
  addTag: async ({ request, params }) => {
    const form = await request.formData();
    // Accept comma separated, take first for a quick add
    const raw = String(form.get('tag') || '');
    const candidates = raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!candidates.length) return fail(400, { error: 'Enter a tag' });

    try {
      await attachContactTags(params.id, [candidates[0]], 'user');
    } catch (e) {
      console.error('attachContactTags failed for contact', params.id);
      // non fatal
    }
    throw redirect(303, `/contacts/${params.id}`);
  },

  removeTag: async ({ request, params }) => {
    const form = await request.formData();
    const slug = String(form.get('slug') || '');
    if (!slug) return fail(400, { error: 'Missing tag' });
    try {
      await detachContactTag(params.id, slug);
    } catch (e) {
      console.error('detachContactTag failed for contact', params.id);
    }
    throw redirect(303, `/contacts/${params.id}`);
  }
};
