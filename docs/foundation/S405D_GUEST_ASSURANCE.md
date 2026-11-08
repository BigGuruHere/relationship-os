# S-405d Guest claims with reusable phone/email assurance

Date: 2026-11-08. Implemented on `feature/s405d-guest-assurance`, based on development `7205d53` (merged PR #39). No live SMS/email, hosted migration or deployment performed. DEV acceptance of S-405b/c remains operator-unverified.

## Behavior and reuse

Guest Send still saves the visitor's details for the sharer immediately. New admitted DEV submissions receive version-2 continuations containing an immutable encrypted snapshot of their exact supported phone/email channels. Claiming requires that browser-bound continuation, an authenticated beneficiary and current proof of a supplied channel. A matching account proof completes the exchange without another message. With JavaScript the page submits a same-origin completion POST automatically after the original Send/auth intent; without JavaScript there is an explicit completion button. GET never settles an exchange.

If proof is missing, the visitor chooses a supplied supported channel and completes its check through the existing account-channel service. The destination comes from the submission, never the form. Successful phone/email assurance commits before settlement: publication withdrawal, archive or another exchange refusal cannot erase a successfully verified account channel. One verified channel can finish reciprocal saving; the other supplied channel remains independently pending and can be verified in Phone and email settings. The success screen links to My People and the remaining checks.

Existing signed-in profile selection is unchanged and requires no SMS. New guest settlement and legacy SMS use a common settlement helper and retain source person IDs/private history. Existing verified account links are reused for reciprocal saving; an originating unverified duplicate that conflicts with an established account association still requires recovery rather than merging histories. No mutual Connection, continuing update permission or private-note disclosure is created.

## Authority and persistence

The service reuses session verification, exact capability lookup, global exchange serialization, sorted account/vault locks and transaction-time publication/lifecycle checks. Current account proof is resolved under those same locks as settlement and revocation. Internal account-channel adapters are import-allowlisted; routes cannot mint ACCOUNT_CHANNEL scope or submit an arbitrary proof ID as authority. Shared persistent budgets moved into exchangeBudget to avoid a circular service dependency; this is the same budget implementation and namespace.

The additive migration `20261108010000_s405d_guest_assurance` adds `claimVersion` and encrypted `submittedChannelsEnc` to FoundationExchange. It enforces version shape and immutable channel snapshots. Existing rows remain version 1 with no snapshot; they are not backfilled. Account associations additionally permit ACCOUNT_CHANNEL authority, while PROFILE and legacy SMS retain their constraints. No new tables: **111 migrations / 24 Foundation tables**.

The old SMS reader/verification handler remains compatible with existing version-1 browser cookies for their original 24-hour lifetime. New browser intake calls only the version-2 writer. A retry attempting to reinterpret a version-1 receipt as version 2 is refused and needs a fresh exchange; no historic receipt is bulk-claimed or upgraded. Internal compatibility functions remain for tests/draining, and must not become a second new browser writer. Browser continuations keep their original expiry, account/session challenge binding and separate browser cookie.

A channel's verification does not certify the name or other printed profile fields. A phone proof cannot verify email. A shared or reassigned number never merges accounts; the existing database exclusivity rule and recovery behavior remain. Removing/revoking a channel prevents new claims using it, without deleting another owner's saved contact or notes. Privacy expiry/suspension/erase handling includes version-2 exchange rows through the existing dependency adapter.

## Email delivery and setup

A small server-only adapter uses the fixed Resend HTTPS send endpoint, a 12-second timeout, plain-text code email and a dispatch-specific idempotency key. It shares the encrypted outbox, attempt/cooldown limits, account/origin/global budgets and cleanup logic with SMS. Resend API reference inspected for this implementation: [Send Email](https://resend.com/docs/api-reference/emails/send-email) and [idempotency keys](https://resend.com/blog/engineering-idempotency-keys). No SDK dependency or provider account was created.

The sender defaults disabled. Configure these in the Railway DEV environment, without putting secrets in chat or Git:

| Variable | Value to supply |
| --- | --- |
| RESEND_API_KEY | API key for the operator's Resend account |
| RELISH_VERIFICATION_EMAIL_FROM | Sender address on a domain verified for that account, optionally `Relish <address>` |
| RELISH_EXCHANGE_TEST_EMAILS | Comma-separated approved DEV recipient email addresses |

Existing DEV origin/database binding, exchange browser flag, realm, encryption/session secrets and SMS allowlist/sender settings remain required. Email controls show sender setup pending when configuration is absent. Dispatch additionally checks the approved recipient list and never logs addresses, codes, credentials or provider response bodies. No live delivery is claimed from mocked tests. Resend was chosen as a configurable default because no functioning email sender exists in the repository; the operator can select another adapter before live setup.

Phone and email use separate canonical destination keys and independent proofs. Existing account, origin and global limits are shared across both transports and guest/settings entry points. A resend invalidates previous codes for that account channel. Switching the exchange's selected channel binds the browser to the new channel's challenge; it does not revoke unrelated account verification work or falsely verify both channels.

## Google assurance

The callback now requires Google's expected issuer, configured audience, valid signature/time, recent issued-at and expiry claims, exact nonce including rejection of missing nonce, a real subject and `email_verified === true`. Only that newly validated callback can invoke the reviewed Google proof adapter after a persisted session exists and the account is ACTIVE in the admitted DEV cohort. Its proof records GOOGLE_OIDC for that exact email; it never verifies a phone, changes credential matching or reactivates revoked assurance. Old OAuth rows are not backfilled. A proof-recording conflict does not block ordinary login and emits only a fixed safe warning.

## Migration and rollback

Apply the additive migration before deploying the new writer/readers. For local development with the intended DEV target:

```sh
# Apply this stage's migration to the configured local development database only.
npx prisma migrate dev
```

Railway uses the established migration startup workflow after authorised merge/deployment. No hosted database was contacted by the implementation tests. Disabling the exchange browser flag stops new browser entry points while retaining the additive schema and compatible privacy services. After version-2 writes, do not deploy an older writer or erase the new fields as rollback; retain compatible readers and roll forward. Email sender setup can remain absent while phone claims and retained proof are tested. Production remains deferred.

## Validation and DEV acceptance

Local validation passed 80 checks across service, private privacy/pilot, auth, route/browser-boundary and profile flows; Svelte reports zero errors/warnings. Added coverage includes phone proof reuse without dispatch, concurrent completion, wrong-account denial, independent pending email, email-only delivery/proof, immutable claim versions, revoked assurance, proof retained after source withdrawal, Google revocation and missing/mismatched nonce/coerced flags. Existing legacy SMS and owned-profile tests remain active. Real PostgreSQL and native Chromium results are recorded in the PR. The local Chromium attempt encounters the existing process-singleton socket restriction.

After DEV deployment/migration:

If using one mobile for both test accounts, revoke its verification on the first account before verifying it on the second; current verified ownership is exclusive.

1. With two admitted test accounts, submit guest details to Mark's public card while signed out. Verify immediate saving for Mark. Sign in/create Betty through that continuation.
2. Verify a supplied allowlisted phone or email. Confirm both My People entries, then inspect retained assurance and the independently pending second channel. Verify the second channel separately in settings.
3. Open another fresh exchange using a channel already verified on Betty's account. Confirm completion with no new code delivery. Private notes and existing IDs/history must remain intact.
4. Test email-only intake after sender setup, delivery failure, Continue later, expired continuation, wrong account, revoked channel and a withdrawn source profile. A successful proof must remain recorded if saving the exchange is blocked.
5. Test fresh Google signup/sign-in using the same submitted verified email. Confirm email assurance is reused; phone remains pending. Revoked email must stay revoked until an explicit fresh verification.
6. Record deployed SHA, migration status, mobile results and authorised real provider delivery outcomes. Combined recovery/device acceptance and production readiness remain S-405e.


## DEV diagnostic follow-up, 2026-11-08

PR #40 merged at development `6239d4a`. The operator configured email settings but reported HTTP 400. A supplied event was for adding a channel, not dispatch; its timestamp was 22:15 Melbourne and it may be older than the latest attempt. The live cause is unconfirmed.

The diagnostic fix distinguishes INVALID_PHONE/INVALID_EMAIL (including the PHONE-default dropdown trap), ENVIRONMENT_DISABLED, SESSION_INVALID, ACCOUNT_INACTIVE, SCHEMA_NOT_READY, DATABASE_UNAVAILABLE and DESTINATION_NOT_APPROVED. Actual email dispatch classifies provider HTTP 401/403/422-class/429/5xx failures without reading/logging response bodies. The UI carries a random support reference for failed dispatch as well as other operations. No address, code, account/session ID, key or SQL payload is logged.

Current settings require choosing Email, adding one address, then explicitly selecting Send verification code beside that pending email. Adding alone does not send. After deployment retry once and collect only the new page reference and matching operation/reason. Check Resend delivery logs only for a new dispatch attempt. Existing budgets, DEV gating, ownership and proof rules remain in force. No migration, environment mutation or live provider send in the fix.
