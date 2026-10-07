# Stage 7.3.4 - Commercial Values

## What changed

- Deal `valueCents` is now Prisma `BigInt` / PostgreSQL `BIGINT`.
- Want, Offer, MarketLead and legacy ExchangeItem min/max commercial values are now `BigInt` / `BIGINT`.
- The migration only widens existing integer columns. It does not delete or rewrite business records.
- Commercial value entry now uses millions across Deals, Wants, Offers and Leads.
  - Enter `5` for $5 million.
  - Enter `12.5` for $12.5 million.
  - Enter `500` for $500 million.
  - Enter `1200` for $1.2 billion.
- The supported UI ceiling is $100 trillion, entered as `100000000` million.
- Money parsing uses integer/string arithmetic rather than JavaScript floating point, so large values remain exact.
- BigInt database values are converted to browser-safe strings before SvelteKit page data is returned.
- Lead -> Want, Lead -> Offer and Lead -> Deal conversions retain the raw BigInt commercial values.
- Display formatting is compact, for example `$5.0m`, `$12.5m`, `$500.0m`, `$1.2b`, `$100.0t`.

## Migration

Migration:

`20260826174500_stage7_3_4_commercial_values_bigint`

It widens these columns:

- `Deal.valueCents`
- `Want.valueMinCents`, `Want.valueMaxCents`
- `Offer.valueMinCents`, `Offer.valueMaxCents`
- `ExchangeItem.valueMinCents`, `ExchangeItem.valueMaxCents`
- `MarketLead.valueMinCents`, `MarketLead.valueMaxCents`

## Dev test order

1. Run `npx prisma migrate dev` against the dev database.
2. Confirm Prisma applies only the Stage 7.3.4 migration and does not request a new migration name.
3. Open an existing Want/Offer/Deal with a value and confirm the old amount is unchanged, but edit fields now show the amount in millions.
4. Create a Want with min `5` and max `12.5`. Confirm it displays `$5.0m to $12.5m`.
5. Create an Offer with value `500`. Confirm it displays `$500.0m`.
6. Create or edit a Deal with value `1200`. Confirm it displays `$1.2b` and its weighted value still works.
7. Test a value above the old integer limit, for example `500` ($500m), and confirm it saves without a Prisma integer error.
8. Optional ceiling test: enter `100000000` ($100t). Confirm it saves and displays `$100.0t`.
9. Confirm a value above `100000000` million is rejected by the form/server validation.
10. Convert a Lead with values into a Want, Offer or Deal and confirm the exact value carries across.

## Production

After dev passes, commit/push the same migration. Production should apply it with the existing `prisma migrate deploy` startup flow. Do not reset either database.
