// src/routes/contacts/[id]/interactions/new/+page.server.ts
// PURPOSE: Create a new interaction note for a contact with optional AI summary and tags.
//          - Validates input with zod
//          - Encrypts raw text and summary using AES-256-GCM
//          - Saves Interaction first
//          - Tries to attach tags to the controlled vocabulary, but never blocks save if tagging fails
//
// SECURITY NOTES:
// - Do not log decrypted PII
// - Only log minimal context like IDs
// - Keep AAD strings stable for future decrypts
//
// DEPENDENCIES:
// - prisma client from $lib/db
// - encrypt from $lib/crypto
// - attachInteractionTags from $lib/tags
// - zod for validation

import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { attachInteractionTags } from '$lib/tags';
import { z } from 'zod';
import { upsertInteractionEmbedding } from '$lib/embeddings';


// Validation schema for form data
const DraftSchema = z.object({
  text: z.string().min(1, 'Please type something'),
  occurredAt: z.string().optional(),
  channel: z.string().default('note'),
  summary: z.string().optional(),
  // tags provided as comma or semicolon separated string from the client
  tags: z.string().optional(),
  // who proposed the tags. default to ai
  tagsSource: z.enum(['ai', 'user']).optional()
});

// Helper to parse a single string into clean tag candidates
function parseTagCandidates(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,;]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    )
  ).slice(0, 12);
}

// AAD constants for encryption to avoid typos
const AAD = {
  RAW: 'interaction.raw_text',
  SUMMARY: 'interaction.summary'
} as const;

export const actions = {
  // Optional draft action if you want a preview flow
  draft: async ({ request }) => {
    const form = await request.formData();
    const parsed = DraftSchema.safeParse({
      text: form.get('text'),
      occurredAt: form.get('occurredAt') || undefined,
      channel: form.get('channel') ?? 'note',
      summary: form.get('summary') || undefined,
      tags: form.get('tags') || undefined,
      tagsSource: (form.get('tagsSource') as 'ai' | 'user') || 'ai'
    });

    if (!parsed.success) {
      return fail(400, { error: parsed.error.flatten().formErrors.join(', ') });
    }

    return { mode: 'draft', draft: parsed.data };
  },

  // Save action that persists the interaction and attempts tag linking
  save: async ({ request, params }) => {
    // Parse and validate form data
    const form = await request.formData();
    const parsed = DraftSchema.safeParse({
      text: form.get('text'),
      occurredAt: form.get('occurredAt') || undefined,
      channel: form.get('channel') ?? 'note',
      summary: form.get('summary') || undefined,
      tags: form.get('tags') || undefined,
      tagsSource: (form.get('tagsSource') as 'ai' | 'user') || 'ai'
    });

    if (!parsed.success) {
      return fail(400, { error: parsed.error.flatten().formErrors.join(', ') });
    }

    // Normalize occurredAt
    const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date();

    // Encrypt sensitive fields
    const rawTextEnc = encrypt(parsed.data.text, AAD.RAW);
    const summaryEnc = parsed.data.summary ? encrypt(parsed.data.summary, AAD.SUMMARY) : null;

    // Defensive check that contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { id: true }
    });
    if (!contact) {
      return fail(404, { error: 'Contact not found' });
    }

    // Create the Interaction first
    let interactionId: string;
    try {
      const created = await prisma.interaction.create({
        data: {
          contactId: contact.id,
          occurredAt,
          channel: parsed.data.channel,
          rawTextEnc,
          summaryEnc
        },
        select: { id: true }
      });
      interactionId = created.id;
    } catch (err) {
      console.error('Failed to save interaction for contact', params.id);
      return fail(500, { error: 'Failed to save note. Please try again.' });
    }

    // After interaction creation, before redirect
    try {
      const raw = parsed.data.text;
      const summaryPlain = parsed.data.summary ?? null; // this is plain text before encryption
      await upsertInteractionEmbedding(interactionId, summaryPlain, raw);
    } catch {
      // non critical, ignore
      console.error('Embedding upsert failed:', e);

    }


    // Attempt to attach tags. This is non critical and must not block the redirect.
    const candidates = parseTagCandidates(parsed.data.tags);
    if (candidates.length) {
      try {
        await attachInteractionTags(
          interactionId,
          candidates,
          parsed.data.tagsSource ?? 'ai'
        );
      } catch (e) {
        // Log minimal context only. Do not leak tag content or note content.
        console.error('attachInteractionTags failed for interaction', interactionId);
        // Intentionally do not return fail here
      }
    }

    // Always redirect after DB work so the user sees their saved note
    throw redirect(303, `/contacts/${contact.id}`);
  }
};
