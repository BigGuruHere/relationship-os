# Stage 8.6 revised v5 - install and verification

This version accounts for the fact that the main Stage 8.6 migration has now been applied to the development database. Do not edit that applied migration and do not reset the database.

## Important cleanup before continuing

A broad migration named `stage8_6_context_space_default_alignment` was generated locally with `--create-only` but was never applied. Delete that generated migration directory before copying in this package. It is intentionally not part of v3.

In PowerShell, from the project root:

```powershell
# Remove only the unapplied broad migration generated during diagnosis.
Get-ChildItem prisma\migrations\*stage8_6_context_space_default_alignment | Remove-Item -Recurse -Force
```

Do not delete `20260901073000_stage8_6_context_space_custody_foundation`. It is already applied and remains unchanged.

## What v3 changed

All 44 ContextSpace sentinel fields now use Prisma's static string default rather than `dbgenerated(...)`:

```prisma
contextSpaceId String @default("00000000-0000-0000-0000-000000000000")
```

The package adds one forward migration:

`20260901165000_stage8_6_context_default_alignment`

It drops the unnecessary database default on `ContextSpace.updatedAt` and restores the sentinel database default on `Task.contextSpaceId`, `Want.contextSpaceId`, and `WantNote.contextSpaceId`.

The original applied 8.6 migration is unchanged byte-for-byte.


## What v4 changes

A development database verification run exposed a lazy PrismaPromise/AsyncLocalStorage edge in `runWithWorkspaceCustody`. The helper now awaits callback results inside the custody boundary so direct Prisma calls such as `() => prisma.agentStep.create(...)` execute while custody is still active.

This is a runtime-only correction. **There are no new or changed migrations in v4.** If the two Stage 8.6 migrations are already applied, leave the database as-is.

The new regression test was mutation-tested and the source-level suite passes **120/120**, including **24/24 Stage 8.6 tests**.


## What v5 changes

The PostgreSQL trigger mutation harness now supplies `CURRENT_TIMESTAMP` for `Contact.updatedAt` in its raw SQL insert. Prisma normally manages `@updatedAt`, but raw SQL bypasses that client-side behaviour. Without the explicit timestamp, PostgreSQL rejected the temporary Contact with `23502 NOT NULL` before the deliberately weakened custody trigger could be tested.

The harness still deliberately omits `contextSpaceId`, still mutates the trigger only inside one transaction, and still forces rollback of both the temporary trigger definition and all test data. A regression assertion was added and mutation-tested.

This is test-harness-only. **There are no schema, application-runtime, or migration changes in v5.** The source-level suite passes **121/121**, including **25/25 Stage 8.6 tests**.

## Development continuation

After copying v5 into the project, run:

```powershell
# Validate the corrected Prisma data model first.
npx prisma validate

# Confirm the live database versus data model difference before applying anything.
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

At that point the diff may show the remaining live alignment operations. Then run:

```powershell
# Apply the intentional forward alignment migration.
npx prisma migrate dev
```

It should apply only:

`20260901165000_stage8_6_context_default_alignment`

It should not ask for another migration name and should not ask to reset. If either happens, stop and inspect the output.

After the migration succeeds, run:

```powershell
# Regenerate Prisma Client and run the release gates.
npx prisma generate
npm test
npm run check:stage8.6
$env:ALLOW_STAGE86_MUTATION_TEST='true'
npm run check:stage8.6:mutation
Remove-Item Env:ALLOW_STAGE86_MUTATION_TEST
npm run check
npm run dev
```

## Expected results

- The main 8.6 migration remains recorded as applied.
- The new alignment migration becomes the only additional applied migration.
- `prisma migrate status` reports the database schema is up to date.
- A datasource-to-datamodel `prisma migrate diff` is empty after alignment.
- Existing Workspace behaviour remains unchanged because existing users still operate in their one default ContextSpace.
- Omitted, null and sentinel custody writes remain fail-closed at the database trigger.

## Production later

Production has not yet received 8.6. Once development verification is clean, `prisma migrate deploy` will apply the main 8.6 migration and then this alignment migration in order. Do not run the mutation script in production.
