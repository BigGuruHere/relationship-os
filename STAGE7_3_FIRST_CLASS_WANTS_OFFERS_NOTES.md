# Stage 7.3 - First-Class Wants and Offers

This release splits the old `ExchangeItem` concept into first-class demand and supply objects.

## Product model

- `Want` = demand: buyer mandate, acquisition criteria, search brief, service need, referral request, or “keep an eye out” request.
- `Offer` = supply: seller opportunity, available asset, introduction, service, capability, capital, referral, or partnership.
- `ExchangeItem` remains in the schema as a legacy compatibility table. New UI writes go to `Want` and `Offer`.

## Added

- First-class `Want` model and `WantNote`.
- First-class `Offer` model and `OfferNote`.
- `/wants` list page and `/wants/[id]` workspace.
- `/offers` list page and `/offers/[id]` workspace.
- `Task.wantId` and `Task.offerId` links.
- `MarketLead.wantId` and `MarketLead.offerId` conversion links.
- Wants and offers can link to contact, company, deal, project, workstream, and company-contact relationship.
- Want and Offer records store `embedding_vec` for Stage 7.4 matching.
- Lead conversion now routes to first-class Want or Offer pages.
- Existing `ExchangeItem` WANT rows are copied into `Want`.
- Existing `ExchangeItem` OFFER rows are copied into `Offer`.
- Existing company acquisition criteria is copied into a Want with type `ACQUISITION_CRITERIA`.
- Company acquisition criteria UI now points users to the Wants section instead of maintaining a parallel criteria field.

## Migration files

- `20260824084000_stage7_3_first_class_wants`
- `20260824085000_stage7_3_first_class_offers`

## Notes

- This release deliberately does **not** build matching yet. Stage 7.4 should add the Want ↔ Offer matching engine.
- `ExchangeItemsPanel.svelte` remains as a compatibility offer panel for existing entity pages; writes are redirected into first-class `Offer` records through `src/lib/server/exchange.ts`.
- The old `ExchangeItem` records are retained for rollback and audit compatibility. Do not delete them yet.
