// scripts/backfill-embeddings.ts
import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { decrypt } from '../src/lib/crypto';
import { upsertInteractionEmbedding } from '../src/lib/embeddings';

async function main() {
  const rows = await prisma.interaction.findMany({
    select: { id: true, rawTextEnc: true, summaryEnc: true }
  });

  for (const r of rows) {
    try {
      const raw = decrypt(r.rawTextEnc, 'interaction.raw_text');
      const summary = r.summaryEnc ? decrypt(r.summaryEnc, 'interaction.summary') : null;
      await upsertInteractionEmbedding(r.id, summary, raw);
      console.log('Embedded', r.id);
    } catch {
      console.log('Skip', r.id);
    }
  }
}

main().finally(() => prisma.$disconnect());
