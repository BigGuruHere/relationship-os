// PURPOSE: Backfill embeddings for existing Interactions without bypassing ContextSpace custody.
// SECURITY: Iterate ContextSpaces at the account boundary, then enter each custody context explicitly.

import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { decrypt } from '../src/lib/crypto';
import { upsertInteractionEmbedding } from '../src/lib/embeddings';
import { runWithWorkspaceCustody } from '../src/lib/server/core/contextSpace';

function interactionEmbeddingText(raw: string, summary: string | null) {
  // IT: Match current Interaction embedding behaviour by preferring the original raw text.
  // Historical rows without raw text may still fall back to their stored summary.
  return raw.trim() || String(summary || '').trim();
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing. Check your .env or shell environment.');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY missing. Embeddings cannot be generated.');
  }

  // SECURITY: ContextSpace itself is the custody container, so it can be enumerated before
  // entering a specific space. Context-scoped Interaction reads happen only inside ALS custody.
  const spaces = await prisma.contextSpace.findMany({
    select: { id: true, ownerUserId: true },
    orderBy: [{ ownerUserId: 'asc' }, { createdAt: 'asc' }]
  });

  let ok = 0;
  let fail = 0;
  let found = 0;

  for (const space of spaces) {
    await runWithWorkspaceCustody(
      { userId: space.ownerUserId, contextSpaceId: space.id },
      async () => {
        const rows = await prisma.interaction.findMany({
          select: { id: true, rawTextEnc: true, summaryEnc: true }
        });
        found += rows.length;

        for (const row of rows) {
          try {
            const raw = decrypt(row.rawTextEnc, 'interaction.raw_text');
            const summary = row.summaryEnc ? decrypt(row.summaryEnc, 'interaction.summary') : null;
            const embedText = interactionEmbeddingText(raw, summary);
            if (!embedText) throw new Error('Interaction has no text to embed.');

            await upsertInteractionEmbedding(space.ownerUserId, row.id, embedText);
            ok++;
            console.log('Embedded', row.id, 'in ContextSpace', space.id);
          } catch (error: any) {
            fail++;
            console.error('Backfill error for', row.id, '-', error?.message || error);
          }
        }
      }
    );
  }

  console.log(`Done. found=${found} ok=${ok} fail=${fail} spaces=${spaces.length}`);
}

main()
  .catch((error) => {
    console.error('Embedding backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
