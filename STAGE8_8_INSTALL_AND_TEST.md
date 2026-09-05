# Stage 8.8 - Installation and verification

## Before installing

Stage 8.8 contains one forward Prisma migration:

```text
20260904184000_stage8_8_lead_batch_import
```

It creates the `CompanyExternalIdentifier` table and its custody guards. Existing Company/Lead data is not rewritten.

Use the dev database first and preserve the normal database backup discipline.

## 1. Replace the source

Replace the current verified Stage 8.7 v2 source with the Stage 8.8 package.

Do not copy an `.env` or `node_modules` directory from the ZIP. Neither is included.

## 2. Validate the final Prisma schema

```powershell
# Confirm the Stage 8.8 schema is valid before touching the database.
npx prisma validate
```

If this fails, stop before running a migration.

## 3. Check migration state

```powershell
# Confirm only the new Stage 8.8 migration is pending.
npx prisma migrate status
```

Expected pending migration:

```text
20260904184000_stage8_8_lead_batch_import
```

If Prisma reports unexpected drift, a reset, or unrelated pending migrations, stop and inspect before proceeding.

## 4. Apply Stage 8.8 to dev

Use the repository's guarded migration command:

```powershell
# Safe wrapper prevents migrate dev from being pointed at production accidentally.
npm run migrate:dev
```

Expected result: Prisma applies the existing Stage 8.8 migration. It should not ask you to create another migration.

If Prisma asks for a new migration name, proposes a reset, or reports drift, stop and paste the output before continuing.

## 5. Regenerate Prisma Client

```powershell
# Regenerate Prisma Client for CompanyExternalIdentifier.
npx prisma generate
```

## 6. Run source behavioural tests

```powershell
# Full Core behavioural suite.
npm test
```

## 7. Recheck custody stages

```powershell
# Stage 8.8 adds another direct ContextSpace model, so rerun the earlier custody gates.
npm run check:stage8.6
npm run check:stage8.7
```

## 8. Run the Stage 8.8 PostgreSQL integration check

```powershell
# Exercises the actual importer against temporary PostgreSQL records.
npm run check:stage8.8
```

The checker should report PASS for:

- first batch create,
- same-batch idempotency,
- later-batch Company reuse with fresh lead research,
- legacy exact-name adoption,
- ambiguous-name fail closed,
- external-id uniqueness,
- cross-ContextSpace reference rejection,
- cleanup.

## 9. Mutation check the Stage 8.6 database trigger again

Stage 8.8 adds a new model protected by the Stage 8.6 custody infrastructure. Re-run the existing trigger mutation proof:

```powershell
# Explicit opt-in because the checker temporarily mutates a trigger inside a rollback transaction.
$env:ALLOW_STAGE86_MUTATION_TEST="true"
npm run check:stage8.6:mutation
Remove-Item Env:\ALLOW_STAGE86_MUTATION_TEST
```

The transaction should roll back its temporary trigger change and temporary data.

## 10. Svelte/TypeScript check

```powershell
npm run check
```

## 11. GUI smoke test with a tiny synthetic CSV first

Use `STAGE8_8_LEAD_IMPORT_TEMPLATE.csv` or a 2 to 3 row test file before importing a real hot 50.

Go to:

```text
Leads -> Import leads
```

Test the following:

1. Upload the test CSV.
2. Set a batch name such as `RTO Import Test - Batch 1`.
3. Set the identifier scheme to `ASQA_RTO`.
4. Select a Project and Workstream if desired.
5. Add a test Company tag.
6. Verify the guessed column mappings and preview.
7. Import.
8. Use **Open this batch** and verify only the imported leads are shown.
9. Open a lead and confirm the external source/code is visible.
10. Confirm the Research note is present and includes batch, CSV filename, row number and external reference.
11. Open the Company and confirm its external identifier and imported lead research history are visible.

## 12. Test same-batch idempotency

Upload the same test file again with the same batch name.

Expected:

```text
No duplicate Company
No duplicate MarketLead for that Company/batch
No duplicate imported Research note
Already in batch count increases
```

## 13. Test a later batch

Import the same external registration code again under a new batch name and change the research text.

Expected:

```text
Existing Company matched
New MarketLead created
New Research note created
Old Research note preserved
Company page shows both research entries
```

## 14. Test an existing Company created before Stage 8.8

If convenient in dev, create a Company manually without an external identifier and then import one row whose Company name is exactly the same.

Expected:

```text
Existing Company reused
External identifier attached
No duplicate Company created
```

Do not deliberately create duplicate Company names in normal GUI testing. The PostgreSQL integration checker covers the ambiguous-name fail-closed behaviour.

## Production deployment

Only after dev verification and GUI use are clean:

```powershell
# Production should only apply committed pending migrations.
npx prisma migrate deploy
```

Production should apply `20260904184000_stage8_8_lead_batch_import` after the already deployed 8.6 migration chain.

Do not run `migrate dev` against production.


## 8.8 v2 index-name alignment

If the main Stage 8.8 migration has already applied and `prisma migrate diff` reports only:

```sql
ALTER INDEX "public"."CompanyExternalIdentifier_userId_contextSpaceId_scheme_valueIdx" RENAME TO "CompanyExternalIdentifier_userId_contextSpaceId_scheme_valu_key";
```

do not create that migration. Stage 8.8 v2 maps Prisma to the actual PostgreSQL-truncated index name instead. Replace the source with v2, run `npx prisma validate`, then rerun the datasource-to-datamodel diff. Expected result: no SQL.
