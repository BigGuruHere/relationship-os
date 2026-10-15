# Stage 8.15.4.2b - Owner bootstrap and account permissions

## Goal

Provide an owner-only admin screen at `/settings/users` to see accounts, existing roles, and explicit `OPERATOR`, `ADMIN`, `BROKER` capability grants. Reuse Stage 8.15.2 policy. No hardcoded user identities and no new migration.

## Initial owner bootstrap (development only)

There is currently no owner account on the reported signed-in user. Before opening the admin page, use your *development* database's Prisma Studio, find your specific User record by its account email, and set **role** from `member` to `owner` once. Do not alter your User ID, create an account with an arbitrary ID, or expose public setup routes. Verify `.env` points to the intended database before opening Studio.

```powershell
# Read your development database connection from .env before starting Studio.
npx prisma studio
```

Sign out and sign in again (or refresh) and open `/settings/users`. The owner should now see **Manage users** in Network navigation. Existing legacy owner behaviour grants MEMBER, OPERATOR, ADMIN and BROKER. The admin page requires owner role even when an account has a standalone ADMIN grant.

For production bootstrap, perform a separate authorised, audited update in the production database after confirming identity and database target. Never copy development account UUIDs or run `migrate dev` against production.

## UI acceptance tests

- [ ] As the owner, open `/network`. Confirm `Manage users` appears.
- [ ] Open `/settings/users`. Confirm account emails, role selectors and grants are visible.
- [ ] Create a dedicated **test** member account and grant `OPERATOR`, save, reload and confirm it persists.
- [ ] Sign in as the test member. Confirm operator routes are accessible only where ContextSpace custody separately allows access.
- [ ] Return as owner, revoke `OPERATOR`; confirm the test member is denied an operator URL on its next request.
- [ ] Confirm member access to `/settings/users` returns HTTP 403, including when logged in with an `ADMIN` grant but not `owner`.
- [ ] Confirm owner cannot demote their own account, and another owner's role cannot be removed when it is the last owner.
- [ ] Confirm account administration does not expose private contacts, notes or Living Understanding; grants and ContextSpace access remain distinct.
- [ ] Run Prisma validation, `npm run check`, `npm run build`, and the stage tests locally.

## Important scope limitations

- This is a first owner-only management page, not a complete access-control audit or safe production IAM console. The list currently displays the first 200 accounts; pagination and better account search should be added before scale.
- Owner role still has broad legacy privileges, and certain older routes may require additional access control before outside pilot users can be invited.
- Changing roles is sensitive: restrict who receives `owner`, keep an audited operational record of permission changes, and add event logging before wider deployment.
- Source-contract tests are not database permission integration tests. No migration is added.
