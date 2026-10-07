# Stage 8.12.8 - installation and verification

## Before replacing your source

Preserve your `.env`, current source ZIP and a restorable **development** database backup/snapshot. Unpack the complete source ZIP into your project directory, retaining your existing `.env`. The Catalina-compatible `package-lock.json` is unchanged from Stage 8.12.7.

```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma validate
npx prisma migrate status
# Confirm DATABASE_URL points to the intended development database.
npx prisma migrate deploy
npx prisma generate
npm run check:stage8.12.8
npm test
npm run check
npm run build
npm run dev
```

This stage **does contain an additive migration** named `20260926113000_stage8_12_8_understanding_realms_topics`. Do not reset the database. `migrate deploy` applies the checked-in migration; there is no need to generate a new migration.

## Browser checks

1. Open an existing Dating person's Living Understanding page and verify old active knowledge and all existing proposal histories remain present.
2. Create `Desired relationship` under Romantic relationships and `Social circle` under Friendships and social life.
3. Assign one active statement to `Desired relationship`, then to `Social circle`; both should show the same statement without duplicating the original claim.
4. Assign to the first topic again. It should remain a single assignment.
5. Remove the statement from `Social circle` and verify it still appears in `Desired relationship` and Current knowledge.
6. Switch to another Dating person. Their topics and private claims must be independent.
7. Check that a possible realm hint is informational only and that assigning a topic does not imply participant confirmation or sharing consent.

## Optional development database integration suite

Only after verifying `.env` targets a development database and the fixture IDs below refer to its owned Dating ContextSpace:

```bash
export DATING_TEST_USER_ID='69335c81-f1b0-4383-96aa-99007d622516'
export DATING_TEST_CONTEXT_SPACE_ID='32e74f61-4249-4768-b524-8c9a24bc3fd9'
export ALLOW_DATING_DEV_DB_TEST=YES
npm run check:stage8.12.8:db
# or run all authorised development DB regression scripts
npm run test:db
```

`SECRET_MASTER_KEY` and `DATABASE_URL` must exist in your local `.env`; do not copy a production key or point the script at production.

## If a check fails

Stop before using the new topic UI if `prisma validate`, the migration, application check/build or custody tests fail. Share the first relevant error rather than resetting Neon. The new integration script tests both the service layer and raw-DB custody guards; source-level tests alone cannot prove the live PostgreSQL triggers are installed correctly.
