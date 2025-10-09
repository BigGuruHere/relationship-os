// IT: summarize endpoint - return vector-based suggestions from existing tags only
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { summarizeText } from '$lib/ai';                 // IT: your existing summarizer
import { suggestTagsForInteraction } from '$lib/tag_suggestions'; // IT: your vector suggester
import { decrypt } from '$lib/crypto';

export const POST = async ({ locals, request }) => {
  // IT: tenant guard
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // IT: read payload
  const body = await request.json();
  const interactionId = String(body.interactionId || '');
  if (!interactionId) {
    return new Response('interactionId required', { status: 400 });
  }

// IT: replace the interaction fetch and summary lines with the following

// IT: fetch encrypted raw text with strict tenant scoping
const interaction = await prisma.interaction.findFirst({
  where: { id: interactionId, userId: locals.user.id },
  select: { rawTextEnc: true }
});
if (!interaction) {
  return new Response('Interaction not found', { status: 404 });
}

// IT: decrypt on the server only
const plaintext = decrypt(interaction.rawTextEnc);

// IT: create the summary from plaintext
const summary = await summarizeText(plaintext);

  // IT: get suggestions from existing tags using pgvector - no persistence here
  // - suggestTagsForInteraction should already read InteractionEmbedding.vec
  // - and rank against Tag.embedding_vec for this same tenant
  const suggestedTags = await suggestTagsForInteraction({
    userId: locals.user.id,
    interactionId,
    topK: 8,        // IT: small list for UI chips
    minScore: 0.25  // IT: nudge threshold if suggestions feel noisy
  });

  // IT: return summary plus suggestions - do not write any tag rows here
  return json({
    summary,
    suggestedTags    // IT: array of { id, name, score } or your existing shape
  });
};
