# S-403 Exchange browser integration

Implemented on `feature/s403-exchange-browser` from development `dd1d7d0` (merged PR #32), 2026-11-07. No new Prisma migration. The S-402 baseline remains 109 migrations and 20 foundation tables. No live SMS, enrollment, deployment or production promotion was performed by this implementation.

## Experience and boundaries

The existing public card, detail-sharing form and optional profile screen remain the entry flow. A supported Australian mobile exchange on explicitly enabled DEV creates the secure S-402 continuation in the capture transaction. Unsupported/no-phone submissions and other environments use ordinary capture. Self-scans return to My Profiles before capture. Successful sharing still sets the navigation receipt so repeat downloads skip the form.

The third screen offers verification for an existing account, or signup followed by verification. A fixed `/exchange/claim` auth return carries no token or personal details. Password and Google signup use the existing encrypted draft and create an unpublished profile. Existing accounts retain their own profile data. Exchange signup/login bypasses legacy lead claims. Account participation is separate from phone assurance; no submitted email/name/phone match establishes an account association.

The claim route joins the existing owner-private routing boundary, so ACTIVE accounts do not resolve a legacy workspace for verification.

The claim and independent random browser binding are encrypted/HttpOnly root cookies, limited to 24 hours. The service binds each issued challenge to the authenticated account and persisted session; switching session requires a new challenge and switching beneficiary requires a fresh exchange. Forms enforce same-origin submission, encoding and bounded bodies. Service errors produce generic recovery copy. Continue later retains the continuation until expiry. Successful verification clears it and opens My People. The user can separately review/publish their own profile in My Profiles.

Send/retry reuses the pending challenge after a delivery failure; Request a new code rotates it, subject to cooldown and aggregate budgets. Each valid code request scrubs expired queued payloads for that source owner. The offline `expire-exchanges` command remains available for owners with no further traffic; no periodic worker is started by this PR. Terminal proof/destination retention and erasure follow S-402/P-305.

## Controlled DEV setup

The UI requires all existing S-402 prerequisites, plus `RELISH_EXCHANGE_BROWSER_ENABLED=YES`. It defaults off. Keep the canonical DEV origin, exact `RELISH_DEV_FOUNDATION_PILOT_TARGET`, stable DEV-only `RELISH_EXCHANGE_REALM`, approved `RELISH_EXCHANGE_TEST_PHONES`, and configured Telnyx sender/key. Enabling the browser flag is an operator action after deployment; perform the first live send only with an explicitly approved destination.

The existing owner-only Account permissions page can now create a second generated foundation test login. The original first-account operation retains its one-account limit; the explicit second slot permits at most two generated accounts, under the same lock and DEV/owner checks. No existing account is converted.

To test a genuinely new password or Google signup, the operator may configure `RELISH_EXCHANGE_SIGNUP_EMAILS` with one or two credential emails. New-account admission requires browser activation, exact DEV binding, a valid browser exchange cookie, the fixed exchange auth return and membership in that server allowlist. It occurs inside the transaction creating the account/profile/private roots. Failure rolls all of them back. Existing accounts are never enrolled by this mechanism. The allowlist grants controlled DEV participation only, and phone verification remains mandatory for settlement. Remove the allowlist after acceptance.

Generated fixture accounts and signup-allowlisted accounts are separate bounded mechanisms. Use only the pair needed for the chosen acceptance scenario. Normal public signup remains outside the foundation cohort.

## Acceptance and recovery

Local tests exercise cookie tampering/browser binding, fixed redirects, form origin/encoding/size, server-resolved request addresses, account/session challenge checks and success clearing. Existing password/Google profile-onboarding tests include the exchange return. The disposable DEV-account suite covers the second-slot cap and atomic allowlisted-signup rollback. Existing service tests cover actual proof, settlement and privacy races with intercepted SMS. Svelte type/compile checks cover the new screen. CI reruns the full foundation suite and real PostgreSQL 18.6 service checks.

Live mobile/browser and provider acceptance remains operator work on DEV, not a claimed result:

1. Enable the reviewed DEV configuration and choose either generated existing-account or allowlisted fresh-signup testing.
2. In separate browser sessions, publish Mark's test profile, save it as Betty and send approved test details.
3. Complete password or Google signup/sign-in. Request the approved SMS, verify and confirm both private People lists contain the exchanged details. Review the new account's unpublished profile separately.
4. Repeat Save contact, continue later, retry delivery and request a new code. Check Skip and missing/unsupported phone still work. Test session/account switches, archive and private-note isolation.
5. Record deployed SHA, devices, account scenario and approved destination outcome. Disable browser activation if acceptance fails.

Application rollback disables `RELISH_EXCHANGE_BROWSER_ENABLED` and removes the UI adapter while keeping S-402 tables and compatible privacy tooling. No schema rollback or data backfill is required. S-404 adds unlink/recovery UX and records DEV acceptance. Hosted restore/erasure replay remains deferred until production preparation.

## First DEV acceptance report

PR #33 merged at `0b3444a`. The operator confirmed deployment and successful intake into Mark's People, but reported blocked claim-page forms and hard-to-find publication controls. The [DEV acceptance fix](S403_DEV_FIXES.md) corrects the native form referrer policy and improves publication controls. Reciprocal live SMS acceptance is still pending.
