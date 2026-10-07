# Stage 8.12.0.1 - Living Understanding workflow correction

## What changed

- New statement creation includes an initial decision: Confirm, Not sure yet, Reject, or Save proposal. The immutable proposal and first review are written in the same transaction.
- Existing statements display only their current wording and decision until Edit is selected. History separately reveals the original proposal and each meaningful revision.
- An unchanged repeat confirmation is a no-op. Repeated concurrent review requests for a given proposal use a PostgreSQL transaction advisory lock before checking the latest decision and appending a new event.
- Audit events explicitly identify the present reviewer as `OPERATOR`. No current UI permits Dorian or a participant to assert their own identity as reviewer. Existing events without an actor display as operator-originated for this pilot; do not interpret them as participant confirmation.
- KnowledgeClaims and KnowledgeEvidence retain Dating ContextSpace and owner scoping and third-party-reported authority; neither confirmation nor editing is disclosure permission.

## Safety and deployment

No schema changes or new migrations. The existing migration directory and Catalina-compatible `package-lock.json` are unchanged. Preserve `.env` and local changes when installing. Do not run the postponed dependency-update script on macOS Catalina. Existing known dependency vulnerabilities remain unresolved; do not expand the external Dating pilot before production security remediation.

## Mac installation

```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma generate
npx prisma migrate status
npm run check:stage8.12.0.1
npm run check:stage8.12.0
npm run check:stage8.11.3
npm run check:stage8.10.4:voice
npm run check
npm run build
```

## Opt-in PostgreSQL integration test on the existing development database

Check `.env` points to development first. The script creates a unique contact, verifies creation, repeat and concurrent reviews, tests other-context denial and deletes its own fixture records. It does not reset the database.

```bash
export DATING_TEST_USER_ID='69335c81-f1b0-4383-96aa-99007d622516'
export DATING_TEST_CONTEXT_SPACE_ID='32e74f61-4249-4768-b524-8c9a24bc3fd9'
export ALLOW_DATING_DEV_DB_TEST=YES
npm run check:stage8.12.0.1:db
```

## Browser acceptance

1. In Dating > People > Living Understanding, add a new statement and click Confirm. It should appear once under Existing statements and be marked Operator reviewed.
2. Open its History. It should show one original proposal and one initial review. There should be no need to confirm it a second time.
3. Click Edit without changing anything and click Confirm. History should remain unchanged.
4. Click Edit, change the statement and Confirm. Current wording changes; History retains the original and adds one review event.
5. Set Not sure yet, then revisit via Edit. Each genuine decision change should be retained.
6. Repeat using Save proposal and Reject to verify pending and rejected status.
7. Verify unrelated contacts cannot see the private statement. A real participant review and cross-context sharing are not implemented here.

## Next architecture checkpoint

Stage 8.12.1 remains the mandatory Relating architecture review before implementing multiple touchpoints. Avoid widening the Introduction model before that decision.

## Verification status

The standalone idempotency policy and structural regression checks run without PostgreSQL. The new database test must be run on your development database, and `npm run check` / `npm run build` must be run on your Mac if dependency installation is unavailable in the packaging environment.
