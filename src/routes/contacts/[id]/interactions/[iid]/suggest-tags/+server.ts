// IT: use only pgvector for tag suggestions - no float8[] fallback
import { prisma } from '$lib/db';

// IT: helper - read the interaction's pgvector embedding with strict tenant scoping
async function loadInteractionVecStrict(userId: string, interactionId: string): Promise<number[]> {
  // IT: select only what we need - the vec column
  const rec = await prisma.interactionEmbedding.findFirst({
    where: { userId, interactionId },
    select: { vec: true }
  });

  // IT: fail early if the vector is missing - this keeps the pipeline honest
  if (!rec?.vec) {
    throw new Error('No vector found for this interaction. Ensure you write InteractionEmbedding.vec at creation time.');
  }

  // IT: many pg drivers return vector as a string like "[0.1,-0.2]". Normalize to number[]
  if (Array.isArray(rec.vec)) return rec.vec as number[];
  const s = String(rec.vec).trim().replace(/^\[/, '').replace(/\]$/, '');
  return s ? s.split(',').map((x) => Number(x)) : [];
}

// IT: inside your POST handler, replace the old loader call with:
const vec = await loadInteractionVecStrict(locals.user.id, params.iid);
// IT: then pass `vec` into your tag suggestion search as before
