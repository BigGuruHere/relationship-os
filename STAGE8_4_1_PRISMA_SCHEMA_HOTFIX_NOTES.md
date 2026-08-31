# Stage 8.4.1 - Prisma schema validation hotfix

## Purpose

Stage 8.4 accidentally declared the following reverse relation fields twice on `Contact` in `prisma/schema.prisma`:

- `interactions`
- `objectives`
- `knowledgeClaims`

Prisma correctly rejected the schema with P1012 before running any migration.

## Fix

The duplicate second declarations were removed. The original declarations remain unchanged.

There are no database, migration, runtime, or data-model changes in 8.4.1 beyond making the intended 8.4 Prisma schema valid.

## Database safety

- No new migration was added.
- The Stage 8.4 migration is unchanged.
- If Prisma failed with P1012 before the migration, the database was not modified by that command.
- Do not reset the database.

## Local validation sequence

```bash
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm test
npm run check:stage8.4
```

The migration should apply the existing Stage 8.4 migration:

`20260831193000_stage8_4_interaction_knowledge_pipeline`

Prisma should not ask for an additional migration name.
