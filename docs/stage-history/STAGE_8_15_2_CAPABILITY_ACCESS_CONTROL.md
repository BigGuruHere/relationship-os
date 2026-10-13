# Stage 8.15.2 - Capability-based access enforcement

## Delivered

- Account roles remain `owner`, `member`, `guest` for compatibility.
- Account-scoped, independently revocable `OPERATOR`, `ADMIN`, and `BROKER` grants are stored in `UserCapabilityGrant`. Every authenticated request reloads grants; the ContextSpace resolver still independently verifies owner and domain.
- All legacy `owner` accounts retain broad privileges. `member` gets `MEMBER` only by default, `guest` gets none. This is a compatibility policy, not a migration that promotes existing members.
- Server hook denies matched privileged routes with HTTP 403 (unauthenticated pages redirect to sign-in; APIs return 401). Page loads, form actions, and matching API routes receive the same pre-route check.
- Operator-protected paths: `/general/admin`, legacy `/general/reviews`, `/general/people`, and `/general/conversations/import`.
- Admin-protected: `/settings/agents`.
- Broker-protected: `/leads`, `/companies`, `/deals`, `/agents`, `/workstreams` and `/api/leads`.
- Relevant navigation links are omitted when the account lacks the capability. General home does not enumerate participants for ordinary members.

## Before deployment

1. Back up production and verify migration checksums; never edit older migrations.
2. Run `npm ci`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run check`, relevant stage tests, and `npm run build` in the deployment environment.
3. Confirm the actual operator account has `User.role = owner` or has an `OPERATOR` grant. **Do not assume every existing account is an owner.**
4. To assign grants, use a trusted database administrative operation, not a public API. Insert an application-generated UUID, the intended user ID, and one of `OPERATOR`, `ADMIN`, `BROKER` into `UserCapabilityGrant`. Record a grantor when known. Revoking a grant deletes that row; requests re-read rights.
5. Verify member and guest 403 responses, owner access, independent broker/operator grants and cross-context isolation against a real database.

## Known limits / next steps

- The route map is a first enforcement slice, **not** a full exhaustive privilege audit across all legacy application routes or internal service calls. Some historic specialist workflows (`wants`, `offers`, `projects`, background agent entrypoints) require individual classification. Do not invite untrusted pilot accounts until that audit has finished.
- Webhook/service-to-service routes need their own existing secrets and authentication; a human capability check is not a substitute.
- No operator-facing grant-management screen is added. Grants must be provisioned through audited trusted administration until the later member/admin experience stage.
- Authorization is account-scoped; ContextSpace permissions remain separate. A capability alone does not grant cross-tenant access.
- No end-to-end browser or live database tests were run in this source-only environment.
