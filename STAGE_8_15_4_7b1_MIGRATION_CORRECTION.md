# Stage 8.15.4.7b.1 — NetworkPhoneCaller.updatedAt correction

## Reason

The already-applied migration `20261019150000_stage8_15_4_7b_provisional_phone_caller` defined `updatedAt` with `DEFAULT CURRENT_TIMESTAMP`, but Prisma schema defines `@updatedAt` with no database default. We keep that already-applied migration **unchanged** and add a separate forward-only correction.

## IMPORTANT: NEVER reset the database

Do **not** run `prisma migrate reset` or edit the original 8.15.4.7b migration. Do not reintroduce the cancelled 8.15.4.7a migration directory `20261019153000_stage8_15_4_7a_verified_phone_custody`.

## Development Neon — SQL correction already run manually

You have already executed:

```sql
ALTER TABLE "NetworkPhoneCaller" ALTER COLUMN "updatedAt" DROP DEFAULT;
```

After installing the new migration folder, register it as **already applied** without running it a second time:

```powershell
npx prisma migrate resolve --applied 20261019220000_stage8_15_4_7b1_phone_caller_updatedat_correction
npx prisma migrate status
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma
```

Expected: status up-to-date and `No difference detected`. Do not run `migrate dev` before marking the migration applied; the manual SQL modification otherwise registers as drift.

If `migrate resolve` reports the migration is already applied, first run `migrate status` and check `_prisma_migrations` before retrying; do not reset.

## Production Neon — SQL not run manually

Deploy the migration folder in the same source tree and apply pending migrations through the standard deployment pipeline using:

```powershell
npx prisma migrate deploy
```

If production has not yet applied 8.15.4.7b, both the base and corrective migrations will apply in order. If it has applied the base migration, just the correction will apply. The correction SQL is idempotent with respect to the default being absent; note that normal Prisma migration tracking still applies.

Before production deployment, verify the correct `DATABASE_URL` points to the intended production database, that a backup exists, and that your deployment process runs `migrate deploy` exactly once in a controlled environment.

## Separate Windows Prisma client DLL lock

Stop the dev server and Prisma Studio before running `npx prisma generate`; retry after they're stopped. The Windows EPERM error is independent of migration drift. Your `npm run check` passed, but Prisma Client generation still needs successful execution.

## Migration required?

Yes, this patch adds exactly one new tracked migration. Do not generate any additional migration for this correction.
