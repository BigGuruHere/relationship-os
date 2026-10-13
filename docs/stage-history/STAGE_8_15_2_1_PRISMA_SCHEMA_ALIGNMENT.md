# Stage 8.15.2.1 - Prisma Schema Alignment

## Purpose

Resolve the unexpected `npx prisma migrate dev` prompt following Stage 8.15.2 **without deleting existing database foreign keys or renaming deployed Living Understanding indexes**.

## Changes made

- Added explicit Prisma relations from `LivingUnderstandingSourceReviewDisposition` to `User`, `ContextSpace`, `Contact`, and `Interaction`, all with `onDelete: Cascade` and the **existing deployed constraint names** through `map:`.
- Added the required inverse relations to those four models.
- Changed `updatedAt` to `@default(now()) @updatedAt`, matching the database's existing `CURRENT_TIMESTAMP` default while retaining Prisma-managed update timestamps.
- Added explicit `map:` names for ten Stage 8.13 indexes. The names are the **actual 63-character PostgreSQL identifiers**, not the longer original SQL string literals.
- Added a non-database regression test that checks these contracts against the original migration SQL and `schema.prisma`.
- Added `npm run check:stage8.15.2.1`.

**No new SQL migration was added. No existing migration was changed.** This correction aligns Prisma's declared schema with the database structure that earlier migrations already created.

## Developer steps

1. If an `inspect_pending_changes` migration was generated but **never applied**, check `npx prisma migrate status` first, then remove only that uncommitted inspection directory. Do not remove any migration already applied or shared with another environment. Do not use `prisma migrate resolve` without investigating its effects.
2. Replace your source with this Stage 8.15.2.1 package.
3. Run:

```sh
npm ci
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm run check:stage8.15.2.1
npm run check:stage8.15.2
npm run check:stage8.14.6
npm run check
npm run build
```

4. **Expected:** Assuming no unrelated database drift exists, `migrate dev` reports the schema is already in sync and does **not** request another migration name. If it does, **stop** and inspect the newly proposed SQL rather than applying it.
5. If Prisma prompts to reset the database, **do not accept**. Back up and investigate the drift first.

## Verification performed here

- Stage 8.15.2.1 schema-alignment source tests: **2 passed**.
- Stage 8.15.2 capability policy tests: **3 passed**.
- Stage 8.14.6 Review Inbox tests: **3 passed**.
- Historical migration SQL left unchanged, including the 81 protected checksum lineage.
- **Not performed:** `npx prisma validate`, a live `prisma migrate dev`, a Prisma `migrate diff`, `npm run check`, `npm run build`, or database integration tests. `npm ci` could not complete in this environment. The expected no-op migration outcome is therefore **not yet confirmed against your database**.

## Why these changes matter

The original Stage 8.14.5 migration defined four referential constraints. Prisma's model omitted their declarations, so Prisma proposed removing them. The Stage 8.13 migration also created indexes whose database identifiers differ from Prisma's implicit names, so Prisma proposed renaming them. Aligning the model to the **existing** constraints avoids a destructive or unnecessary migration and preserves review custody integrity.

This work does not expand anyone's permissions or alter stored private content.
