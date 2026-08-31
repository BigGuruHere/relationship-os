// scripts/check-stage8-3-consolidation.ts
// PURPOSE: Read-only post-migration verification that ExchangeItem is retired and canonical intent data is structurally sound.

import { prisma } from '../src/lib/db.ts';

async function scalar(sql: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(sql);
  return Number(rows[0]?.count || 0n);
}

async function main() {
  const [exchangeTable, legacyColumns, legacyTaskSources, badWantStatuses, badOfferStatuses] = await Promise.all([
    scalar(`SELECT count(*)::bigint AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'ExchangeItem' AND c.relkind = 'r'`),
    scalar(`SELECT count(*)::bigint AS count FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'exchangeItemId' AND table_name IN ('Want','Offer','MarketLead')`),
    scalar(`SELECT count(*)::bigint AS count FROM "Task" WHERE lower(COALESCE("sourceType", '')) IN ('exchangeitem','exchange_item','exchange-item','exchange')`),
    scalar(`SELECT count(*)::bigint AS count FROM "Want" WHERE "status"::text NOT IN ('CAPTURED','CLARIFYING','ACTIVE','PAUSED','FULFILLED','WITHDRAWN','EXPIRED','ARCHIVED')`),
    scalar(`SELECT count(*)::bigint AS count FROM "Offer" WHERE "status"::text NOT IN ('CAPTURED','CLARIFYING','ACTIVE','PAUSED','FULFILLED','WITHDRAWN','EXPIRED','ARCHIVED')`)
  ]);

  const values = { exchangeTable, legacyColumns, legacyTaskSources, badWantStatuses, badOfferStatuses };
  console.log('Stage 8.3 Want/Offer consolidation integrity:', values);
  if (Object.values(values).some((value) => value !== 0)) {
    throw new Error('FAIL: Stage 8.3 consolidation check found legacy or invalid rows.');
  }
  console.log('PASS: Stage 8.3 canonical Want/Offer consolidation is internally consistent.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
