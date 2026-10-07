# Stage 8.8.3 - Install and Test

## 1. Replace the source

Use the Stage 8.8.3 package as the complete source tree.

Do not copy `.env` from the package. Keep the existing local environment file.

## 2. Validate before migration

Run:

```bash
npx prisma validate
npx prisma migrate status
```

Before installation, the expected pending migration is:

```text
20260907133500_stage8_8_3_import_batch_filtering
```

If Prisma reports unexpected drift, asks for a reset, or lists another unknown migration, stop before changing the database.

## 3. Apply the dev migration

Prefer the repository safety wrapper:

```bash
npm run migrate:dev
```

If the wrapper refuses because the local `APP_ORIGIN`/`NODE_ENV` safety conditions are not configured as development, inspect those environment values rather than bypassing the guard blindly.

The migration should apply `20260907133500_stage8_8_3_import_batch_filtering` and should not need a second generated migration.

## 4. Regenerate Prisma Client

```bash
npx prisma generate
```

## 5. Confirm alignment

```bash
npx prisma migrate status
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

Expected result:

- migration status says the database is up to date;
- the diff emits no SQL.

## 6. Run tests

```bash
npm run check:stage8.8.1
npm run check:stage8.8.2
npm run check:stage8.8.3
npm test
npm run check
```

## 7. GUI check

Start Relish:

```bash
npm run dev
```

Then:

1. open Leads;
2. confirm there is a separate **Batch** filter;
3. confirm imported calling-batch names no longer clutter the general **Source** dropdown;
4. choose a Batch and open a lead;
5. add a Lead Note;
6. confirm the lead still has the same Return to list target;
7. optionally change priority from 3 to 2;
8. click Return to list;
9. confirm the same filtered Batch reloads and the priority order is refreshed.

## Production

After dev verification, production applies the committed migration with the normal deployment path:

```bash
npx prisma migrate deploy
```

Do not use `prisma migrate dev` against production.
