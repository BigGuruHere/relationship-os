# Stage 8.12.3 - Install and test

## Install on macOS Catalina

Extract the complete source ZIP into your working project while preserving your `.env` and local changes. From Terminal:

```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run check:stage8.12.3
npm run check:stage8.12.0.1
npm run check:stage8.12.2
npm run check
npm run build
```

No new migration. Decline any request to reset the database. The Catalina-compatible lockfile is unchanged.

## PostgreSQL integration test on your existing development database

Confirm `.env` points to development. In Mac Terminal:

```bash
export DATING_TEST_USER_ID='69335c81-f1b0-4383-96aa-99007d622516'
export DATING_TEST_CONTEXT_SPACE_ID='32e74f61-4249-4768-b524-8c9a24bc3fd9'
export ALLOW_DATING_DEV_DB_TEST=YES
npm run check:stage8.12.3:db
```

The DB test uses only disposable fixtures and closes Prisma afterward. It tests pending proposals, source ownership, approved knowledge, independent provenance, idempotency, rejection and clean fixture removal. It does not test the live browser or automated Dorian extraction.

## Browser walkthrough

1. Run `npm run dev`. Open Dating > People and choose a person.
2. Record an independent reflection, or a reflection linked to a touchpoint.
3. Click **Propose knowledge from this reflection**.
4. Choose a category, type a short proposed statement and choose **Save proposal**. Verify it does not yet appear in Current knowledge.
5. Confirm the item in Existing statements; verify it appears under Current knowledge with the chosen category, operator review attribution and linked evidence.
6. Confirm it unchanged a second time. No duplicate knowledge or review history should appear.
7. Edit and correct it. Both prior and new wording should be retained in statement history.
8. Reject it. It should disappear from Current knowledge without changing the original reflection.
9. Open a different person and confirm that the original reflection is inaccessible as a knowledge source.

**Security boundary:** operator review is not participant confirmation and grants no permission to disclose the knowledge. Production dependency updates remain deferred; do not expand the external Dating pilot until relevant security work is completed.
