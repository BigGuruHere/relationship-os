# Stage 8.8.5 - Install and test

Stage 8.8.5 adds one small Prisma migration for reusable MarketLead Next Action options.

## 1. Replace source

Replace the prior development source with the full Stage 8.8.5 package while preserving your local `.env` and other untracked secrets.

## 2. Validate schema

```bash
npx prisma validate
```

## 3. Check pending migrations

```bash
npx prisma migrate status
```

The new Stage 8.8.5 migration is:

```text
20260907144000_stage8_8_5_lead_next_action_options
```

If Stage 8.8.3 has not yet been installed on this database, you may also still see:

```text
20260907133500_stage8_8_3_import_batch_filtering
```

That is expected. Do not create another migration.

## 4. Apply pending development migrations

Use the repository's guarded migration command:

```bash
npm run migrate:dev
```

If Prisma asks to reset the database, reports unexpected drift, or asks to create an additional migration, stop and inspect the output rather than accepting it.

## 5. Regenerate Prisma Client

```bash
npx prisma generate
```

## 6. Confirm migration alignment

```bash
npx prisma migrate status
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

Expected result:

- migration status says the database is up to date;
- the diff emits no SQL.

## 7. Run source tests

```bash
npm run check:stage8.8.1
npm run check:stage8.8.2
npm run check:stage8.8.3
npm run check:stage8.8.4
npm run check:stage8.8.5
npm test
npm run check
```

## 8. Run real PostgreSQL verification

```bash
npm run check:stage8.8.5:db
```

This verifies:

- the six default options load;
- a new custom option persists;
- a case variant does not create a duplicate;
- the custom option is not visible in a second ContextSpace owned by the same User;
- temporary verification data is cleaned up.

## 9. GUI smoke test

```bash
npm run dev
```

Open an existing MarketLead and check Next Action in the Details panel:

1. confirm the standard options appear;
2. choose `Initiate contact` and confirm it autosaves;
3. type a new value such as `Send information pack` and allow it to autosave;
4. open another lead;
5. confirm `Send information pack` is now offered in the Next Action dropdown;
6. change priority and use Return to list to confirm the existing working-queue workflow still behaves normally;
7. open Edit Lead and confirm the same Next Action vocabulary is available there.

## Production

After development verification, production should use:

```bash
npx prisma migrate deploy
npx prisma generate
```

or the repository's normal production deployment command that runs `prisma migrate deploy` before application startup.
