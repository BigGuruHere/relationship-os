# Stage 8.15.4.2c - Member Access Security (first enforcement pass)

## Changes in this release
- Server request capability routing now requires ADMIN for `/settings/context-spaces` (including its page actions), not merely an authenticated account.
- All `/general` operator pages require OPERATOR, including `/general` itself and its nested routes. `/network` remains a separate member-facing route and continues to resolve the user's own General ContextSpace.
- `/api/task-commercial-links` now requires BROKER, consistent with brokerage functionality.
- Shared authenticated layout counters (reconnects, reminders, tasks) now include **both** `userId` and resolved `contextSpaceId`. Previously these aggregated across a user's contexts.
- Existing owner-only `/settings/users` check retained. No schema changes or migrations.

## Verification actually performed
- `npm run check:stage8.15.4.2c`: three static source/policy tests passed.
- `npm run check:stage8.15.4.2b`: three legacy static source tests passed.
- No installed dependencies in packaging environment, therefore **not run**: `npm run check`, `npm run build`, Prisma validation, real DB integration tests, browser tests, penetration tests.

## IMPORTANT: This is NOT a complete member isolation/security certification
This is a targeted enforcement increment. Several legacy Business, Dating, CRM and file/API endpoints still admit normal members with sufficient authentication, because privilege modelling, guest workflows and purpose-specific access have not been audited end-to-end. Cross-user identifiers in actions and webhook tokens also require targeted active tests. Do **not** invite untrusted external users based on this patch alone.

## Installation
Replace the previous full source with this full source package (preserve environment secrets and local data); run:
```
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm run check:stage8.15.4.2c
npm run check:stage8.15.4.2b
npm run check
npm run build
```
No new migration was authored. If migrate dev proposes one, abort and inspect before creating it.

## Local acceptance tests
1. With the existing owner account, `/settings/users`, `/settings/context-spaces`, `/general/people` and `/network` should work.
2. With a separate plain member account, `/network`, `/network/share` and its own Personal profile should work.
3. As the plain member, direct GET `/settings/context-spaces`, `/general`, `/general/people`, and POST to `/settings/context-spaces?/createGeneral` should return 403 (when signed in).
4. As a member with ADMIN but not owner, `/settings/context-spaces` should be accessible but `/settings/users` must still respond 403.
5. As a member with OPERATOR, `/general/people` should work for **that account's own** General ContextSpace, not the owner's.
6. Observe the reconnect/reminder/task totals while navigating Business to Network and Dating; only the active ContextSpace's records should count.
7. Confirm QR public profile remains accessible when not logged in.
8. Confirm no Prisma migration generated and owner permission management still persists after a refresh.

## Before external users are safe
- Design and enforce explicit permissions for legacy Business and Dating app routes and direct APIs.
- Audit identity and invite paths plus per-record `userId` AND `contextSpaceId` checks for CRUD and exports.
- Add real DB integration tests for member-vs-owner and cross-user/cross-context denial, webhook replay, direct POSTs, file access, invitation retry.
- Add owner grant audit trail and regression coverage for concurrent owner role updates.
