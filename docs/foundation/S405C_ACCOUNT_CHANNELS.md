# S-405c Account channels and SMS proof

Date: 2026-11-07. Implemented on `feature/s405c-account-channels`, based on development `42ae818` (merged PR #38). Feature branch only; no live database migration, SMS send or deployment performed. S-405b live DEV acceptance is still operator-unverified.

## User behavior

My Profiles links to **Phone and email verification** at `/settings/channels`. An admitted ACTIVE DEV account can add personal Australian mobiles or emails. Adding creates PENDING, never VERIFIED. Email stays pending with an honest next-stage message; this stage has no email sender. Account login credentials and printed profile fields are unchanged.

Phone verification uses the existing Telnyx sender, canonical AU validation and approved DEV destination allowlist. Explicit Send requests a session-bound six-digit code. Success records account-owned proof, method and time. Subsequent settings requests recognise verified status without another send. Revoke cancels pending codes and retires current assurance; Verify again requires a new challenge and keeps the old revoked proof. Removing a revoked channel explicitly erases that channel and its proof/challenge/delivery history. Replacement is a separately added pending record, leaving other channels unaffected.

Ordinary owned-profile exchange still uses profile control, without SMS. Guest exchange SMS remains on its existing exact-exchange path. S-405d will connect reusable account assurance to guest claims, email delivery and trusted Google proof. No account email, profile value, previous SMS exchange or OAuth row is silently marked verified. Dorian caller recognition is not changed by this stage.

## Persistence and authority

One additive migration, `20261107030000_s405c_account_channels`, creates four tables: FoundationAccountChannel, FoundationAccountChannelVerification, FoundationAccountChannelChallenge and FoundationAccountChannelDispatch. The Foundation prefix follows the existing query-guard boundary; these records are owned by the User account, without a relationship vault FK. Migration count becomes **110**, Foundation table count **24**. Existing rows, associations, enrollments and credentials are untouched.

Canonical values and retryable dispatch payloads are encrypted with account/record/field authenticated data. Type/realm/purpose-separated HMACs support necessary equality checks. Values and owner bindings are immutable. Settings returns masked values and proof status/time/method, never codes or plaintext destinations. The existing realm must remain stable; changing it is not a routine configuration operation.

The new ACCOUNT_CHANNEL scope requires current persisted session, admitted DEV configuration and ACTIVE root under existing global exchange/account/vault locks. The ORM guard restricts scalar operations to that account and denies unscoped queries, relational traversal, nested writes and cross-owner creates. Routes call services and cannot mint this scope. Only the reviewed service and privacy adapter can establish it; boundary tests list exact imports.

The database enforces account/channel compound foreign keys, a partial unique index for one current verified claim per canonical channel, immutable proof bindings, monotonic revocation/terminal challenge states and deferred consistency between verified status and current unrevoked proof. Pending rows do not reserve another account's number. A conflicting claim fails generically and cannot disclose the other account or merge private histories.

Proof success, consumption and status commit atomically. A same-account/session retry returns the current result; another session or generation cannot consume it. Revocation prevents use of a consumed old challenge. The pilot's global exchange lock also serializes channel verification, revocation and privacy changes. It is held during the existing bounded Telnyx call, preserving the current low-throughput pilot limitation. Provider acceptance followed by process/database failure can duplicate a message; no exactly-once external delivery claim is made.

## Budgets, dispatch and privacy

Codes expire in 15 minutes. Five aggregate failures and five sends per channel/hour survive resends and revocation; a resend waits 60 seconds and invalidates old generations. Three bounded provider attempts per dispatch are allowed; terminal failure clears the encrypted payload. Settings and guest exchange share existing per-account, phone, request-origin and global hourly budgets, preventing separate entry points from resetting protection. Opening another pending channel does not reset destination/account budgets.

Settings operations scrub expired pending payloads. The existing confirmed offline `expire-exchanges` operation now also scrubs the selected account's dormant channel dispatch/challenges, without sending anything. Vault suspension cancels queued/failed channel deliveries and revokes pending challenges while retaining account proof history. Vault-only erasure retains account channels, which have a different lifecycle from private relationship data. Owner revoke/remove handles individual channel removal. Full account closure and its backup/retention obligations remain separate release work; this stage does not claim to complete them.

Operational logs contain only component, random support reference, allowlisted operation and generic reason. No code, address, channel/account/session identifier, provider payload or raw SQL error is logged. UI failures do not disclose whether another account holds the destination.

## Migration and rollback

Synthetic tests apply the migration after all three earlier foundation/exchange migrations. For local development with the intended DEV configuration:

```sh
# Apply the new additive migration only to your configured local development target.
npx prisma migrate dev
```

Railway uses the existing approved migration startup workflow after merge/deployment. No new environment variables are required: existing DEV database binding, browser activation, stable realm, approved test phones, Telnyx sender/API key and encryption/session configuration are reused. Never paste secrets in chat or commit them.

Before activating the new code, apply this migration. Compatible privacy code now knows about channel tables, so do not deploy it against an unmigrated database. Rolling back UI activation can disable the existing exchange browser flag, leaving additive tables in place. Retain the compatible privacy/expiry adapter after channel writes. Do not drop proof tables or use an old eraser as a substitute for account closure.

## Validation and DEV acceptance

Local validation passed 70 service, privacy, pilot, boundary, route, profile and onboarding checks, with zero Svelte errors/warnings. These checks cover independent phone/email pending state, normalization/idempotency, no plaintext in projections, unscoped/traversal denial, wrong owner/session, code failures, concurrent retries, revocation/reverification history, duplicate destination contention, immutable DB bindings, provider retry caps, resend invalidation, cumulative failure limits, offline expiry, suspension cancellation and owner removal. Existing P-305/P-306 and profile/exchange regressions also run. Real PostgreSQL contention and native Chromium settings form submission run in CI; results are recorded in the PR. Local Chromium reaches the existing process-singleton socket restriction, rather than completing a local browser pass.

After authorised DEV merge/deployment/migration:

1. Sign into an admitted test account, open My Profiles, then Phone and email verification.
2. Add your allowlisted AU mobile and an email. Both should show pending. Send and enter a fresh SMS code. Only the phone becomes verified; email remains pending.
3. Revisit the page and confirm proof/time persist with no new send. Revoke the phone, wait for any resend cooldown, then verify again. Removing a revoked channel removes only its account record/history.
4. Confirm selected-profile exchange still works without SMS. Guest claims still use the existing flow until S-405d. Check login, private People and Brokerage separately.
5. Record deployed SHA, migration status and actual outcomes. No production promotion follows automatically.
