// scripts/backfill-embeddings.ts
// PURPOSE: backfill embeddings for existing interactions with detailed logging.
import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { decrypt } from '../src/lib/crypto';
import { upsertInteractionEmbedding, buildInteractionEmbeddingText } from '../src/lib/embeddings';

async function main() {
  // Quick sanity checks
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing. Check your .env or shell env.');
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY missing. Summaries and embeddings will fail.');
  }

  const rows = await prisma.interaction.findMany({
    select: { id: true, rawTextEnc: true, summaryEnc: true }
  });
  console.log(`Found ${rows.length} interactions.`);

  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      // Decrypt fields using the exact AAD strings used on write
      const raw = decrypt(r.rawTextEnc, 'interaction.raw_text');
      const summary = r.summaryEnc ? decrypt(r.summaryEnc, 'interaction.summary') : null;

      // Quick guard to avoid sending empty text to the embedder
      const embedText = buildInteractionEmbeddingText({ summary, raw });
      if (!embedText) {
        throw new Error('Empty text after buildInteractionEmbeddingText');
      }

      await upsertInteractionEmbedding(r.id, summary, raw);
      ok++;
      console.log('Embedded', r.id);
    } catch (e: any) {
      fail++;
      console.error('Backfill error for', r.id, '-', e?.message || e);
    }
  }
  console.log(`Done. ok=${ok} fail=${fail}`);
}

main().finally(() => prisma.$disconnect());
