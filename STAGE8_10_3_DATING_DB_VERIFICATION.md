# Stage 8.10.3 - Dating workflow PostgreSQL verification

This release adds a **real database integration test**, not a source-text inspection. The external OpenAI HTTP response is replaced with deterministic data; Prisma, encryption, service functions, and database triggers remain real. It also labels one-sided continuation explicitly in Dating UI and records the respondent's participant ID in the encrypted Outcome evidence.

## Before running on the existing development database

- Back up or snapshot the development database.
- Ensure `.env` is your development database and includes `DATABASE_URL` and its matching `SECRET_MASTER_KEY`.
- Install dependencies (`npm ci`), generate Prisma Client (`npx prisma generate`), and check migrations (`npx prisma migrate status`). Apply outstanding migrations to **development only** with `npx prisma migrate dev`. Decline any reset prompt.
- In Dating, identify your existing user UUID and a Dating ContextSpace UUID that you own. You can inspect the `User` and `ContextSpace` tables in `npx prisma studio`; the correct `ContextSpace` has `domainKey=dating` and `ownerUserId` matching your user UUID. The test deliberately does **not** create or alter your real account's login details.

Run from the project folder on your Mac:

```bash
# Choose the existing development account and its Dating ContextSpace.
export DATING_TEST_USER_ID='YOUR-USER-UUID'
export DATING_TEST_CONTEXT_SPACE_ID='YOUR-DATING-CONTEXT-SPACE-UUID'

# Explicitly authorise database fixture writes and cleanup on your development DB.
export ALLOW_DATING_DEV_DB_TEST=YES

# Run the deterministic PostgreSQL integration test. This script reads .env.
npm run check:stage8.10.3:db

# Re-run ordinary checks and build.
npm run check:stage8.10
npm run check
npm run build
```

This test creates two uniquely named Contacts, one Introduction, multiple private Interactions, model audit rows, proposals and reviews. It tests: save and encrypted retrieval, source/participant audit links, rejection without an Outcome, approval under two concurrent attempts with exactly one Outcome, replay denial, model failure and retry, same-owner cross-context denial, and cross-owner denial. Only records attached to its newly created IDs are deleted on completion. The test **also** creates a temporary ContextSpace and temporary empty User to verify isolation. Agent setup may seed standard agent definitions/permissions for the chosen existing user if they are not already present; these shared setup records are intentionally retained. It has no `migrate reset` or bulk deletion of existing data.

**Do not run against production.** If the test stops before cleanup (process killed, computer crash), its uniquely named test Contacts begin with `stage8-10-3-`, enabling manual review. A partial run should be investigated before repeating it.

## Limits and remaining tests

The code was authored without a database connection in the packaging environment. A green result must be obtained on your Mac before treating the DB workflow as verified. A separate browser check is still needed for password registration/login, session expiry/logout, recording and transcription. The next workstream is targeted lockfile/audit triage, then a full pilot smoke test.

No database schema change or migration is included in Stage 8.10.3.
