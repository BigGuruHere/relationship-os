# Relish Stage 8.13.0 - Longitudinal Living Understanding Persistence Foundation

## Release scope

This release is Gate 1 of Stage 8.13. It establishes the canonical production persistence model before the longitudinal AI review UI is connected.

Key changes:

- Removes the unreleased Stage 8.12.14, 8.12.14.1 and 8.12.15 migration directories from the canonical migration chain.
- Adds one production-forward migration: `20261002010000_stage8_13_0_longitudinal_living_understanding_foundation`.
- Separates immutable topic versions from revision snapshot membership through `LivingUnderstandingRevisionTopic`.
- Adds relational topic-version provenance through `LivingUnderstandingTopicVersionSource`.
- Adds explicit revision lineage through `previousRevisionId`.
- Adds server-side unchanged-topic carry-forward.
- Adds stale-baseline protection and idempotent revision persistence.
- Adds baseline/source binding fields to `LivingUnderstandingDraft` and prevents pre-baseline drafts being resumed after an authoritative revision exists.
- Adds a production migration checksum manifest and integrity checker for all 81 migrations already present in the supplied production `_prisma_migrations` history.

## Important migration boundary

The supplied production migration history does not contain the development-only migrations:

- `20261001013000_stage8_12_14_persisted_living_understanding`
- `20261001013100_stage8_12_14_1_index_name_alignment`
- `20261001054500_stage8_12_15_living_understanding_drafts`

All 81 migration files that are present in production were SHA-256 checked against the supplied production history and matched before this package was created.

## Development database reset

Your current development database has already applied the removed 8.12.14/15 development migrations. Because you confirmed that its data is disposable, recreate/reset the development database before applying this release.

Do not run a reset against production.

Recommended local sequence after backing up anything you unexpectedly want to retain:

```powershell
npx prisma migrate reset
npx prisma migrate status
npx prisma validate
npm run check:migration-integrity
npm run check:stage8.13.0
```

Then run the opt-in real DB integration test:

```powershell
$env:ALLOW_DATING_DEV_DB_TEST="YES"
$env:DATING_TEST_USER_ID="<development user id>"
$env:DATING_TEST_CONTEXT_SPACE_ID="<development Dating ContextSpace id>"
npm run check:stage8.13.0:db
```

The DB integration test creates a disposable contact and two private reflection sources, proves v1 -> v2 carry-forward, checks topic-specific provenance, idempotency, stale-baseline rejection, rollback and cleanup.

## Production deployment

Production should not be reset. The normal deployment remains:

```powershell
npx prisma migrate deploy
```

Before deploying, run:

```powershell
npm run check:migration-integrity
npx prisma validate
npx prisma migrate status
npm run check:stage8.13.0
```

The Stage 8.13.0 migration is written as a forward migration from the existing production boundary and creates the Living Understanding persistence tables for the first time in production.

## Verification completed in this package build

Completed successfully in the packaging environment:

- production checksum comparison: 81/81 deployed migration names matched repository SQL
- `node scripts/check-migration-integrity.mjs`
- Stage 8.13.0 focused static suite: 19/19 passed
- Stage 8.6 ContextSpace custody suite after the model inventory change: 25/25 passed
- selected Stage 8.12 semantic and persistence regression tests passed

Not completed in the packaging environment:

- `npx prisma validate`
- `npm run check`
- real DB integration test
- fresh PostgreSQL `prisma migrate deploy` rehearsal

The package environment could not complete dependency installation, so Prisma/Svelte binaries were unavailable. Run those commands locally before applying the development reset or deploying production.

## Next gate

Stage 8.13.1 should connect the production longitudinal engine to this foundation:

`latest authoritative revision + one new authorised source -> affected persisted topic identities -> changed topic versions only -> authoritative next revision`

The old revision experiment remains present only as development/reference code in this release. It is not yet the new production longitudinal review workflow.
