// tests/core/stage8-3-want-offer-consolidation.test.ts
// PURPOSE: Lock down Stage 8.3 canonical Want/Offer consolidation and ExchangeItem retirement.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20260831180000_stage8_3_want_offer_consolidation/migration.sql', 'utf8');
const wants = readFileSync('src/lib/server/wants.ts', 'utf8');
const offers = readFileSync('src/lib/server/offers.ts', 'utf8');
const common = readFileSync('src/lib/server/intentCommon.ts', 'utf8');
const browserCommon = readFileSync('src/lib/intents.ts', 'utf8');
const marketLeads = readFileSync('src/lib/server/marketLeads.ts', 'utf8');

function modelBlock(name: string) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  return match?.[0] || '';
}

test('Want and Offer remain the two canonical intent models with one neutral lifecycle', () => {
  assert.match(schema, /enum IntentStatus \{[\s\S]*CAPTURED[\s\S]*CLARIFYING[\s\S]*ACTIVE[\s\S]*PAUSED[\s\S]*FULFILLED[\s\S]*WITHDRAWN[\s\S]*EXPIRED[\s\S]*ARCHIVED[\s\S]*\}/);
  assert.match(modelBlock('Want'), /status\s+IntentStatus/);
  assert.match(modelBlock('Offer'), /status\s+IntentStatus/);
  assert.doesNotMatch(schema, /model Intent \{/);
});

test('legacy ExchangeItem authority is fully absent from target schema', () => {
  assert.doesNotMatch(schema, /model ExchangeItem \{/);
  assert.doesNotMatch(schema, /exchangeItemId|exchangeItems\s+ExchangeItem|ExchangeItemType|ExchangeStatus/);
});

test('shared intent metadata has neutral schema names', () => {
  assert.match(schema, /enum IntentUrgency/);
  assert.match(schema, /enum IntentTimeHorizon/);
  assert.match(schema, /enum IntentConfidence/);
  assert.match(schema, /enum OfferDirection/);
  assert.doesNotMatch(schema, /enum ExchangeUrgency|enum ExchangeTimeHorizon|enum ExchangeConfidence|enum ExchangeDirection/);
});

test('migration repairs legacy rows and hard-blocks retirement when reconciliation is incomplete', () => {
  assert.match(migration, /INSERT INTO "public"\."Want"/);
  assert.match(migration, /INSERT INTO "public"\."Offer"/);
  assert.match(migration, /missing_wants/);
  assert.match(migration, /missing_offers/);
  assert.match(migration, /unresolved_leads/);
  assert.match(migration, /unresolved_tasks/);
  const gate = migration.indexOf("RAISE EXCEPTION 'Stage 8.3 blocked ExchangeItem retirement");
  const drop = migration.indexOf('DROP TABLE "public"."ExchangeItem"');
  assert.ok(gate >= 0 && drop > gate, 'verification gate must appear before ExchangeItem DROP');
});

test('migration rewrites explicit Task provenance before dropping legacy ids', () => {
  assert.match(migration, /SET "sourceType" = 'Want', "sourceId" = w\."id"/);
  assert.match(migration, /SET "sourceType" = 'Offer', "sourceId" = o\."id"/);
});

test('legacy compatibility services/components are physically retired', () => {
  assert.equal(existsSync('src/lib/server/exchange.ts'), false);
  assert.equal(existsSync('src/lib/exchange.ts'), false);
  assert.equal(existsSync('src/lib/ExchangeItemsPanel.svelte'), false);
});

test('Want and Offer share common intent plumbing instead of duplicating it', () => {
  for (const source of [wants, offers]) {
    assert.match(source, /from '\$lib\/server\/intentCommon'/);
    assert.match(source, /parseIntentMoney\(form\)/);
    assert.match(source, /storeIntentEmbedding/);
    assert.match(source, /intentLinkWhere/);
    assert.match(source, /intentUnlinkData/);
  }
  assert.match(common, /table: 'Want' \| 'Offer'/);
  assert.match(browserCommon, /INTENT_STATUSES/);
});

test('MarketLead conversion now targets canonical Want/Offer directly', () => {
  assert.match(marketLeads, /export async function convertLeadToIntent/);
  assert.doesNotMatch(marketLeads, /exchangeItemId|exchangeItem:/);
});

test('runtime source has no legacy ExchangeItem Prisma model access', () => {
  const runtimeFiles = [
    'src/routes/contacts/[id]/+page.server.ts',
    'src/routes/companies/[id]/+page.server.ts',
    'src/routes/deals/[id]/+page.server.ts',
    'src/routes/projects/[id]/+page.server.ts',
    'src/routes/companies/[id]/contacts/[linkId]/+page.server.ts'
  ];
  for (const file of runtimeFiles) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /server\/exchange|prisma\.exchangeItem|tx\.exchangeItem|createExchangeItem|deleteExchangeItem|loadExchangeItems/);
  }
});
