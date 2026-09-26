# Stage 8.12.6 - Install and test on macOS Catalina

This is a complete source replacement, starting from Stage 8.12.5. Keep your current `.env`, local files and a backup of the current directory. The Catalina-compatible `package-lock.json` is unchanged. No migration was added.

```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma validate
npx prisma migrate status
npx prisma generate

npm run check:stage8.12.6
npm test
npm run check
npm run build
```

`npm test` now runs all `.test.ts` and `.test.mjs` files from `tests/core/` instead of just the older TypeScript suite. There should no longer be stale expectations of 46 scoped models and 112 reference boundaries. The 50 models/127 reference boundaries are guarded by a combination of the older generic triggers, the new composite foreign keys and the new specialised Relating SQL triggers.

For the **separate, potentially database-modifying** integration suite, first check that `.env` points to the disposable development Neon database and that the two IDs belong to that development context. Only after verifying this, run:

```bash
export DATING_TEST_USER_ID='69335c81-f1b0-4383-96aa-99007d622516'
export DATING_TEST_CONTEXT_SPACE_ID='32e74f61-4249-4768-b524-8c9a24bc3fd9'
export ALLOW_DATING_DEV_DB_TEST=YES
npm run test:db
```

These sample IDs were provided for an earlier development test. Check that they are still correct for your **current development database**. Never set the opt-in flag when pointing at production. `npm run test:all` also runs the DB suite and therefore requires this same explicit authorisation.

## Browser review

1. Open the same personal reflection in Dating > People > Personal history and choose Propose knowledge from this reflection.
2. Explicitly permit AI processing and ask Dorian for suggestions.
3. Look for separate romantic interest **and** uncertainty about readiness, concrete interests, social goals, work context and relationship preferences. The number and coverage are not guaranteed.
4. If Dorian returns more than 12 candidates, use Next suggestions/Previous suggestions. Make different review decisions across two pages, then save together.
5. Confirm that decisions and source quotes are preserved and that only operator-confirmed items become current knowledge. The original reflection remains unchanged.
6. Check the original three Stage 8.6 failures no longer occur in `npm test`. If another custody test fails, stop and inspect the named edge rather than changing counts again.
