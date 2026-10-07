# Stage 8.12.0 - Install and test (Mac)

1. Extract the complete ZIP into your Relish project, preserving your existing `.env` and any local changes. Check `.env` points to the intended development database.
2. Run from the project directory:

```bash
npm ci
npx prisma generate
npx prisma migrate status
npm run check:stage8.12.0
npm run check:stage8.11.3
npm run check:stage8.11.2
npm run check:stage8.10.4:voice
npm run check
npm run build
```

3. `npm run dev`, open `/dating/people`, add or select a participant, and open `Living Understanding`. Propose one sentence about what matters to them. Edit and confirm it, then add a second sentence and select `Not sure yet`. Reopen and check both statuses and the full review history. Reject a statement and verify it is no longer an active KnowledgeClaim. Verify the other person's page cannot display it, and no data is disclosed to another ContextSpace.
4. There is no new migration. If Prisma asks for a reset, decline and inspect before proceeding.

**Mac terminal** (optional existing Dating database integration test, after confirming `.env` points to development):

```bash
export DATING_TEST_USER_ID='69335c81-f1b0-4383-96aa-99007d622516'
export DATING_TEST_CONTEXT_SPACE_ID='32e74f61-4249-4768-b524-8c9a24bc3fd9'
export ALLOW_DATING_DEV_DB_TEST=YES
npm run check:stage8.10.3:db
```

## Important verification boundary

The focused Stage 8.12.0 tests validate the core helpers, source and isolation guards, not a real HTTP or PostgreSQL end-to-end run of the new page. Browser testing and real database verification remain required. Operator-reviewed knowledge must not be labelled participant-confirmed.
