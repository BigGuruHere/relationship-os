// scripts/backfillUserEmail.ts
// PURPOSE - Backfill User.email_Enc and User.email_Idx from legacy User.email in batches.
// SECURITY - All crypto happens server-side. No plaintext emails are logged. AES-256-GCM for email_Enc and deterministic HMAC for email_Idx.
// USAGE -
//   npx tsx scripts/backfillUserEmail.ts --dry
//   npx tsx scripts/backfillUserEmail.ts --drop-plaintext
// FLAGS -
//   --dry              - simulate without writing
//   --drop-plaintext   - set User.email = NULL after successful write
//
// ASSUMPTIONS -
//   prisma/schema.prisma has:
//     model User { id String @id @default(cuid()); email String?; email_Enc String?; email_Idx Bytes? @unique }
//   You have already run a migration that added email_Enc, email_Idx and the unique index on email_Idx.
//   $lib/crypto exports normalizeEmail, encrypt, buildEmailIndexBytes, buildEmailIndexHex.
//   If you stored email_Idx as String @unique instead of Bytes, set USE_BYTES_INDEX=false below.

import 'dotenv/config'; // IT - load .env so SECRET_MASTER_KEY and DATABASE_URL are available
import { PrismaClient, Prisma } from '@prisma/client';
import { encrypt, normalizeEmail, buildEmailIndexBytes, buildEmailIndexHex } from '$lib/crypto';

const prisma = new PrismaClient();

// IT - set to true if User.email_Idx is Bytes in Prisma schema, false if String (hex)
const USE_BYTES_INDEX = true;

// IT - batch size for raw query pagination
const PAGE_SIZE = 500;

type Flags = { dry: boolean; dropPlain: boolean };

function parseFlags(): Flags {
  const args = new Set(process.argv.slice(2));
  return { dry: args.has('--dry'), dropPlain: args.has('--drop-plaintext') };
}

// IT - record shape returned by the raw query
type UserRow = {
  id: string;
  email: string | null;
  email_Enc: string | null;
  email_Idx: Buffer | null; // Prisma Bytes maps to Buffer in Node
};

async function fetchBatch(afterId: string | null): Promise<UserRow[]> {
  // IT - use a parameterized raw query to avoid Prisma null filter quirks
  const rows = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, "email_Enc", "email_Idx"
    FROM "User"
    WHERE email IS NOT NULL
      AND ("email_Enc" IS NULL OR "email_Idx" IS NULL)
      ${afterId ? Prisma.sql`AND id > ${afterId}` : Prisma.empty}
    ORDER BY id ASC
    LIMIT ${PAGE_SIZE};
  `;
  return rows;
}

async function backfillBatch(afterId: string | null, flags: Flags) {
  const users = await fetchBatch(afterId);
  if (users.length === 0) return { nextAfter: null, scanned: 0, wrote: 0 };

  let wrote = 0;

  for (const u of users) {
    if (!u.email) continue;

    // IT - normalize once so index and ciphertext are consistent
    const norm = normalizeEmail(u.email);
    const email_Enc = encrypt(norm);
    const email_Idx = USE_BYTES_INDEX
      ? buildEmailIndexBytes(norm)
      : Buffer.from(buildEmailIndexHex(norm), 'hex');

    if (flags.dry) continue;

    try {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          email_Enc,
          email_Idx,
          ...(flags.dropPlain ? { email: null } : {}),
        },
      });
      wrote += 1;
    } catch (err) {
      // IT - most common issue is duplicate normalized emails hitting unique constraint
      console.error('Backfill failed for user', u.id, err);
    }
  }

  const nextAfter = users[users.length - 1]?.id ?? null;
  return { nextAfter, scanned: users.length, wrote };
}

async function main() {
  const flags = parseFlags();
  console.log('Backfill start', { PAGE_SIZE, flags, USE_BYTES_INDEX });

  let afterId: string | null = null;
  let totalScanned = 0;
  let totalWrote = 0;

  while (true) {
    const { nextAfter, scanned, wrote } = await backfillBatch(afterId, flags);
    totalScanned += scanned;
    totalWrote += wrote;
    console.log(`scanned +${scanned}, wrote +${wrote}, totals { scanned: ${totalScanned}, wrote: ${totalWrote} }`);
    if (!nextAfter || scanned === 0) break;
    afterId = nextAfter;
  }

  const remaining = await prisma.$queryRaw<{ remaining: bigint }[]>`
    SELECT COUNT(*)::bigint AS remaining
    FROM "User"
    WHERE email IS NOT NULL
      AND ("email_Enc" IS NULL OR "email_Idx" IS NULL);
  `;
  console.log('Backfill complete', {
    totalScanned,
    totalWrote,
    remaining: Number(remaining[0]?.remaining ?? 0),
    dry: flags.dry,
  });
}

main()
  .catch((e) => {
    console.error('Backfill encountered an error', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
