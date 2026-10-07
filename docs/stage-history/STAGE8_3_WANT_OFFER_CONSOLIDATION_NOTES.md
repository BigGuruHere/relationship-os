# Stage 8.3 - Want/Offer Consolidation

## Purpose

Stage 8.3 completes the old exchange migration. It does **not** add another intent model.

Canonical Core representation after this release:

- `Want` = demand/need/desired outcome side.
- `Offer` = capability/supply/availability side.
- Both share neutral lifecycle and common intent plumbing.
- `ExchangeItem` is retired.

## Data safety

Migration:

`20260831180000_stage8_3_want_offer_consolidation`

The migration runs inside an explicit PostgreSQL transaction.

Before any destructive retirement it:

1. creates any missing first-class Want/Offer rows from legacy ExchangeItem rows,
2. fills null canonical entity links from the legacy row without overwriting newer canonical links,
3. migrates explicit MarketLead ExchangeItem links to `wantId` / `offerId`,
4. rewrites explicit Task `sourceType/sourceId` ExchangeItem provenance to the canonical Want/Offer id,
5. counts unresolved legacy rows/Lead links/Task references,
6. raises an exception if any unresolved dependency remains.

Only after the verification gate passes does it remove:

- `MarketLead.exchangeItemId`,
- `Want.exchangeItemId`,
- `Offer.exchangeItemId`,
- the `ExchangeItem` table,
- ExchangeItem-only enums.

If the verification gate fails, the explicit transaction rolls the migration back.

## Neutral intent lifecycle

Want and Offer now share:

- `CAPTURED`
- `CLARIFYING`
- `ACTIVE`
- `PAUSED`
- `FULFILLED`
- `WITHDRAWN`
- `EXPIRED`
- `ARCHIVED`

Historical status mapping:

### Want

- NEW -> CAPTURED
- CLARIFYING_CRITERIA -> CLARIFYING
- ACTIVE_MANDATE -> ACTIVE
- WATCHING_MARKET -> PAUSED
- MATCHED -> FULFILLED
- CONVERTED_TO_DEAL -> ACTIVE (`convertedDealId` remains the operational evidence)
- CLOSED_INACTIVE -> EXPIRED when an elapsed expiry date proves expiry, otherwise WITHDRAWN
- ARCHIVED -> ARCHIVED

### Offer

- NEW -> CAPTURED
- CLARIFYING_SUPPLY -> CLARIFYING
- AVAILABLE -> ACTIVE
- WATCHING_INTEREST -> PAUSED
- MATCHED -> FULFILLED
- CONVERTED_TO_DEAL -> ACTIVE (`convertedDealId` remains the operational evidence)
- CLOSED_INACTIVE -> EXPIRED when an elapsed expiry date proves expiry, otherwise WITHDRAWN
- ARCHIVED -> ARCHIVED

## Shared intent infrastructure

Added:

- `src/lib/intents.ts` - browser-safe common lifecycle/urgency/time/confidence/direction semantics.
- `src/lib/server/intentCommon.ts` - common parsing, money validation, legacy decrypt fallbacks, embeddings, and entity link/unlink plumbing.

Removed:

- `src/lib/exchange.ts`
- `src/lib/server/exchange.ts`
- `src/lib/ExchangeItemsPanel.svelte`

Entity pages now call canonical Offer services/actions directly.

## Legacy encryption compatibility

Some first-class Want/Offer ciphertext was originally copied from ExchangeItem without re-encryption. The canonical helpers intentionally retain explicit legacy AAD fallbacks such as `exchange.title` and `exchange.description` so those historical values remain readable after the ExchangeItem table is removed.

This is encryption compatibility only. It is not a legacy data-model dependency.

## Market Leads

`convertLeadToExchangeItem` is renamed to `convertLeadToIntent` and creates canonical Wants/Offers directly.

`MarketLead.exchangeItemId` is removed after the migration gate confirms each explicit legacy lead link has a canonical replacement.

## Tests

Stage 8.3 adds source-level safety coverage for:

- canonical Want + Offer with no third Intent table,
- neutral shared lifecycle,
- complete absence of ExchangeItem from the target schema,
- hard migration gate before table retirement,
- explicit Task provenance rewrite,
- removal of compatibility services/components,
- shared intent plumbing,
- direct MarketLead -> Want/Offer conversion,
- no runtime legacy Prisma model access.

Expected local command:

```bash
npm test
```

## Post-migration integrity check

Run:

```bash
npm run check:stage8.3
```

Expected final line:

`PASS: Stage 8.3 canonical Want/Offer consolidation is internally consistent.`

## Recommended development test sequence

1. Stop the dev server.
2. Run `npx prisma migrate dev`.
3. Run `npx prisma generate`.
4. Run `npm test`.
5. Run `npm run check:stage8.3`.
6. Start `npm run dev`.
7. Open existing Wants and Offers and verify values/text/provenance still display.
8. Create and edit a Want using the new neutral lifecycle.
9. Create and edit an Offer using the new neutral lifecycle.
10. Open Contact, Company, Deal, Project and Company-Contact pages and create/remove an Offer.
11. Convert a Market Lead to a Want and to an Offer where appropriate.
12. Check task Want/Offer links and workstream mission-control counts/suggestions.

## Important

Do **not** reset the database if the migration verification gate fails. The failure means a legacy dependency was found intentionally before destructive retirement. Capture the migration output and reconcile that specific dependency.
