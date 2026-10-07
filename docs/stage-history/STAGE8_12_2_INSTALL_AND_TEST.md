# Stage 8.12.2 - Installation and tests

## macOS (Catalina-compatible locked dependencies)
1. Preserve `.env` and local edits before replacing Stage 8.12.1 with the new complete source.
2. From `~/Coding/RelationshipOS/relationship-os`, run:

```bash
npm ci
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run check:stage8.12.2
npm run check:stage8.12.1
npm run check:stage8.12.0.1
npm run check
npm run build
```

No new migration is included. Stage 8.12.1's migration must already be applied. Do not run `migrate reset` if Prisma reports drift.

## PostgreSQL test on your existing development database
First ensure `.env` points to **development**, then run these commands on Mac:

```bash
export DATING_TEST_USER_ID='69335c81-f1b0-4383-96aa-99007d622516'
export DATING_TEST_CONTEXT_SPACE_ID='32e74f61-4249-4768-b524-8c9a24bc3fd9'
export ALLOW_DATING_DEV_DB_TEST=YES
npm run check:stage8.12.2:db
```

For Windows PowerShell, use `$env:DATING_TEST_USER_ID='...'` instead of `export` (likewise for the other variables). The test creates temporary contacts, an independent reflection, one touchpoint and an attendee reflection, verifies access checks, and cleans up only its fixtures. It must return to the shell prompt.

## Browser walkthrough
Start `npm run dev` and open Dating → People. Select a new person and open **Personal history**. Add a reflection without an encounter, then record an encounter with a second person and add a reflection attached to it. Confirm the chronology lists all three and that no Introduction was needed. Open Living Understanding to verify it still works. Check an existing person's historical Introduction link, then make sure a new person's page has no other person's private reflection. These are operator-authored records, not the participant's confirmed account or disclosure consent.
