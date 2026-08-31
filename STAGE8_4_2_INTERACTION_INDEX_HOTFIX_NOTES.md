# Stage 8.4.2 - Interaction Index Hotfix

## Purpose

Stage 8.4 intentionally replaced the legacy single-column Interaction index:

```prisma
@@index([contactId])
```

with the tenant-aware composite index:

```prisma
@@index([userId, contactId])
```

The Stage 8.4 migration created the new composite index but did not drop the old
`Interaction_contactId_idx`. After applying Stage 8.4, `prisma migrate dev` therefore detected the
extra database index and prompted for another migration.

## Change

This release adds one forward migration only:

`20260831194500_stage8_4_2_remove_legacy_interaction_contact_index`

It runs:

```sql
DROP INDEX IF EXISTS "public"."Interaction_contactId_idx";
```

No application model or runtime behaviour changes.

## Data safety

This migration:

- does not delete or update rows;
- does not drop tables or columns;
- does not change constraints;
- only removes a redundant legacy index after its tenant-aware replacement already exists.

## Local recovery from the 8.4 prompt

If Stage 8.4 has already applied and Prisma is waiting at:

`Enter a name for the new migration:`

press `Ctrl+C`, install Stage 8.4.2, then run:

```bash
npx prisma migrate dev
npx prisma generate
npm test
npm run check:stage8.4
```

Prisma should apply the 8.4.2 migration and should no longer ask for another migration name.
