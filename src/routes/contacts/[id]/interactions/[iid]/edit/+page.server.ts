// Stage 8.15.3: corrections are new evidence rather than overwrites of historical source text.
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { saveCurrentNoteCorrection } from '$lib/server/core/noteRevisions';
import { createWorkspaceCoreAccess } from '$lib/server/core/accessPolicy';
import { loadCoreInteraction } from '$lib/server/core/interactions';

const EditSchema = z.object({
  channel: z.string().min(1),
  occurredAt: z.string().optional(),
  text: z.string().trim().min(1, 'Correction cannot be empty')
});

export const load = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:correction-load');
  const row = await loadCoreInteraction(context, params.iid);
  if (!row || row.contactId !== params.id) return { notFound: true };
  return { interaction: { id: row.id, contactId: row.contactId, channel: row.channel, occurredAt: row.occurredAt, text: row.text } };
};

export const actions = {
  default: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:correction-save');
    const original = await loadCoreInteraction(context, params.iid);
    if (!original || original.contactId !== params.id) return fail(404, { error: 'Note not found.' });
    const form = await request.formData();
    const parsed = EditSchema.safeParse({
      channel: String(form.get('channel') || ''),
      occurredAt: String(form.get('occurredAt') || ''),
      text: String(form.get('text') || '')
    });
    if (!parsed.success) return fail(400, { error: parsed.error.issues[0]?.message || 'Invalid correction.' });
    const date = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null;
    if (date && Number.isNaN(date.getTime())) return fail(400, { error: 'Invalid interaction date.' });
    try {
      // A correction is new, independently encrypted evidence linked to the original interaction.
      // The original remains available for existing KnowledgeEvidence and LU provenance links.
      const corrected = await saveCurrentNoteCorrection(context, params.id, params.iid, {
        channel: parsed.data.channel, occurredAt: date, rawText: parsed.data.text
      });
      throw redirect(303, `/contacts/${params.id}/interactions/${corrected.id}`);
    } catch (err: any) {
      if (err?.status === 303) throw err;
      return fail(409, { error: err?.message || 'Unable to save correction.' });
    }
  }
};
