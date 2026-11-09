# S-403 DEV acceptance fixes

Feature branch `fix/profile-publish-exchange-origin`, based on development `0b3444a` (merged PR #33), 2026-11-07. No Prisma migration, target database write or live SMS send.

## Report and correction

The operator reported Betty's submitted contact appearing in Mark's People, followed by every claim-page button returning “Please submit from this page.” Continue later was blocked by the same validation. The page used `Referrer-Policy: no-referrer`, which makes native non-CORS form submissions send a null Origin. Its strict origin validator correctly refused that value. The fix is `same-origin` referrer policy; missing, null and foreign origins remain refused. Tokens and personal details remain absent from URLs, and cross-origin referrers remain suppressed.

The claim page initially shows one Send verification code action. A pending request exposes the code field and a secondary resend action. Continue later retains the continuation and returns to My Profiles. Server and session/account assurance checks are unchanged.

An unpublished profile now has a prominent top banner with Publish profile. That button submits the existing editor, including unsaved values, and the existing save action validates and checks ownership before publishing. The publication checkbox still supports unpublishing. My Profiles includes a prominent Review and publish link for draft cards.

## Deployment log diagnosis

The supplied logs show migration lock P1002 retries followed by “No pending migrations to apply” and successful application startup. This establishes eventual migration success in that log, not new migration failure or missing tables. The recorded datasource is pooled. Use a direct Neon connection for the migration CLI while retaining the pooled connection for application queries. Do not disable Prisma advisory locking or terminate sessions to mask the issue.

For the existing Railway startup workflow, the operator can add a secret `DIRECT_URL` from Neon's **same development branch**, choosing the unpooled connection, then use this custom start command. Confirm the branch/database before applying configuration. Do not paste database strings into chat.

```sh
# Override only the migration process; npm start retains the application's pooled DATABASE_URL.
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy && npm start
```

No startup or external database configuration was changed by this branch. The existing `start:with-migrations` remains unchanged. Never change only the URL's branch or substitute production credentials for this DEV task.

The Google OAuth warning came from the legacy lead-linking path and is distinct from the form-origin rejection. The supplied log does not establish which navigation initiated that OAuth request. Exchange auth with the fixed `/exchange/claim` return skips legacy lead claims; regression tests cover that path. Ordinary Google sign-in can still report a non-fatal missing default legacy ContextSpace. Do not create a legacy context, enroll an existing account, or weaken verification merely to silence that warning.

References: [MDN referrer policy and Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy), [Prisma v6 Neon direct migration connections](https://www.prisma.io/docs/orm/v6/overview/databases/neon).

## Validation and acceptance

Focused route, profile-onboarding and multiple-profile checks pass locally; Svelte check reports zero errors/warnings. Null/foreign origins remain blocked. A Chromium fixture renders the actual Svelte screens and calls the real claim route with intercepted provider/domain services. It reproduces the old null-Origin error, checks corrected Send and Continue later, and verifies that the banner submits unsaved editor values. A dedicated CI job installs Chromium and runs this fixture; local Chromium launch was blocked by sandbox socket restrictions. Exact CI results are recorded in the PR.

Retest on DEV after merge/deployment: refresh the claim page, request one approved SMS, verify the code and check both People lists. Check Continue later, publish a draft using its banner and reopen its QR. Record actual deployed SHA and outcomes. Live SMS acceptance remains unconfirmed until that operator test. Rollback is application-only; no schema change or data backfill.

## Follow-up report

PR #34 merged at `d19c12c`. The operator subsequently reports a later service 400 before SMS. The local/international number difference is already normalized by the service. The [send diagnostic follow-up](S403_SEND_DIAGNOSTICS.md) adds correlated safe logs; the remaining live cause is not yet established.
