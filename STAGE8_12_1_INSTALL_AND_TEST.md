# Relish Stage 8.12.1 - Install and test

This release adds a **forward-only migration**. Keep `.env` and local changes. The previously retained Catalina-compatible `package-lock.json` is unchanged. Do not run the postponed dependency-upgrade script on Catalina.

## macOS / Catalina

```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma validate
npx prisma migrate status
# Check that .env selects DEVELOPMENT before applying the migration.
npx prisma migrate dev
# Stop if Prisma offers a database reset.
npx prisma generate
npm run check:stage8.12.1
npm run check:stage8.12.0.1
npm run check:stage8.11.3
npm run check
npm run build
```

On production, after review and backup, use `npx prisma migrate deploy` rather than `migrate dev`.

## Real PostgreSQL test using your current development database

The test creates three distinct contacts and a private Relating group, a subset-attended meeting and one standalone touchpoint. It also creates a **temporary second ContextSpace** to verify cross-context denial, then deletes **only its own fixtures**. Confirm `.env` points to development. This test changes data and is not suited to production.

**Mac:**

```bash
export DATING_TEST_USER_ID='69335c81-f1b0-4383-96aa-99007d622516'
export DATING_TEST_CONTEXT_SPACE_ID='32e74f61-4249-4768-b524-8c9a24bc3fd9'
export ALLOW_DATING_DEV_DB_TEST=YES
npm run check:stage8.12.1:db
```

**Windows PowerShell:**

```powershell
$env:DATING_TEST_USER_ID = '69335c81-f1b0-4383-96aa-99007d622516'
$env:DATING_TEST_CONTEXT_SPACE_ID = '32e74f61-4249-4768-b524-8c9a24bc3fd9'
$env:ALLOW_DATING_DEV_DB_TEST = 'YES'
npm run check:stage8.12.1:db
```

## Browser check

Start `npm run dev`, open `/dating`, and create a normal two-person introduction. Confirm that it still opens, both participants appear, and the existing reflection and Living Understanding flows still work. This stage introduces **no group UI yet**. The group's existence is a private database foundation, not a user-visible relationship status. If you wish, inspect the new `Relating`, `RelatingParticipant` and `Introduction.relatingId` records using `npx prisma studio`.

## Known limitations and stop conditions

- You still need to run the full build and actual database test locally. Static structural checks alone cannot verify PostgreSQL triggers or Svelte routes.
- The old Introduction model is intentionally still A/B for the existing Dating pilot. Stage 8.12.2 must link independent touchpoint reflections before group meetings can be run end-to-end.
- The deferred security audit findings remain unresolved; do not invite external users or broaden sensitive-data exposure until production dependency remediation and end-to-end authentication/voice checks are complete.
- If `migrate dev` asks for a reset, do not agree. If a test fails, preserve the output and investigate rather than resetting the database.
