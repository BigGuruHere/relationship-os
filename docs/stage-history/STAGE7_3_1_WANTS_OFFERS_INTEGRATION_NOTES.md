# Stage 7.3.1 - Wants / Offers Integration Fix

## Purpose

Stage 7.3.1 completes the transition from legacy `ExchangeItem` WANT/OFFER records to the first-class `Want` and `Offer` models without deleting historical data.

The migration is forward-only and non-destructive. Do not reset either database for this stage.

## What changed

### 1. Safe legacy repair and verification migration

Migration:

`20260825073000_stage7_3_1_wants_offers_integration`

It:

- copies any legacy WANT `ExchangeItem` that somehow missed the Stage 7.3 copy into `Want`
- copies any legacy OFFER `ExchangeItem` that somehow missed the Stage 7.3 copy into `Offer`
- repairs missing company acquisition-criteria Wants
- fills `MarketLead.wantId` / `MarketLead.offerId` when the lead has an explicit legacy `exchangeItemId`
- fills `Task.wantId` / `Task.offerId` only when the Task explicitly identifies an ExchangeItem through `sourceType` + `sourceId`
- leaves all legacy `ExchangeItem` rows in place
- aborts the migration if any legacy WANT/OFFER remains without a first-class counterpart
- emits verification counts in the migration logs

### Important task migration limitation

The historical `Task` model never had an `exchangeItemId` foreign key. Therefore there is no safe way to infer that a generic old task belonged to one particular Want or Offer merely because they share a Contact, Company, Deal, or Project.

Stage 7.3.1 does not guess those links.

If a historical Task has explicit ExchangeItem provenance in `sourceType` + `sourceId`, it is migrated automatically. New Stage 7.3 tasks already use `wantId` or `offerId` directly and are unaffected.

## 2. Strong ownership validation for Want / Offer links

New helper:

`src/lib/server/commercialEntityLinks.ts`

Want and Offer create/update operations now tenant-validate every supplied:

- contact
- company
- deal
- project
- workstream
- company-contact relationship

The validator also rejects mismatched workstream/project and company-contact/contact/company combinations.

## 3. Agents now read first-class Wants and Offers

`readEntityContext.ts` no longer reads legacy `ExchangeItem` rows for Want/Offer context.

Agent context now exposes:

- `wants`
- `offers`
- compatibility `wantsOffers`

This means newly-created Stage 7.3 Wants and Offers are visible to agent workflows.

## 4. Acquisition criteria now stays in Want

Company edits no longer clear the legacy `Company.criteriaEnc` field simply because the old criteria input is no longer on the form.

Company research now prefers first-class `ACQUISITION_CRITERIA` Wants and only falls back to the legacy company field for compatibility.

When a reviewed agent enrichment proposes `company.criteria`, applying it now writes to a first-class acquisition-criteria Want rather than continuing to update the legacy company criteria field.

## 5. Workstream Wants and Offers

Individual workstream pages now show first-class:

- Wants
- Offers

They can be created and deleted directly from the workstream and are locked to the correct Project + Workstream.

Workstream summary cards also show Want and Offer counts.

## 6. Offer panels

Entity pages now render the first-class `OffersPanel` UI. Existing Stage 7.3 compatibility action names remain supported on those pages to minimise server-route churn, but the underlying writes already go to `Offer`, not `ExchangeItem`.

## Deployment order

1. Commit/deploy this package normally.
2. Railway should run `prisma migrate deploy` before starting the app.
3. Confirm migration `20260825073000_stage7_3_1_wants_offers_integration` succeeds.
4. Look for the Stage 7.3.1 verification notices in migration output.
5. Confirm `missing WANT=0` and `missing OFFER=0`.

Do not run `prisma migrate reset`.

## Recommended UI test order

1. Open `/wants` and confirm existing Wants are present.
2. Open `/offers` and confirm existing Offers are present.
3. Open a Company with acquisition criteria and confirm its Want still appears.
4. Edit that Company and save it, then confirm the acquisition-criteria Want is still present.
5. Open a Project Workstream and confirm Wants and Offers panels appear.
6. Create a test Want from that Workstream and confirm it opens/appears under the correct Workstream and Project.
7. Create a test Offer from that Workstream and confirm the same.
8. Create a Task from a Want detail page and confirm it appears under that Want.
9. Create a Task from an Offer detail page and confirm it appears under that Offer.
10. Run an agent/context workflow against a Contact, Company, Deal, or Project with a newly-created Want/Offer and confirm the new item is available in its context.

## Next stage

Stage 7.4 can now use the first-class architecture directly:

`Want.embedding_vec` -> `Offer.embedding_vec`

There is no need for the matching engine to use legacy `ExchangeItem` OFFER rows.
