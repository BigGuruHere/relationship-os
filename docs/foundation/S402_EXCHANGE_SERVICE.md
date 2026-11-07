# S-402b SMS claim and reciprocal settlement service

Implemented on `feature/s402b-sms-claims`, based on development `477adb9` (PR #31), 2026-11-07. This is a server-service deliverable, not a deployment or completed browser flow. S-403 will connect the existing three screens and fresh DEV account admission. No live SMS or target database writes were performed.

## Reuse and scope

Reuse P-302 capture and nonce receipts, F-204 account/vault lifecycle locks, encrypted private People primitives, P-305 support controls, the existing DEV origin/database gate, and the direct Telnyx sender. The missing capability is exact-exchange proof followed by one atomic transaction across two private vaults. Legacy Brokerage, existing public capture, login, notes and ordinary People readers retain their current paths.

`captureFoundationContact` retains its existing behavior. The new internal `captureFoundationExchange` additionally issues a continuation and encrypted selected-card snapshot in the same transaction. It requires a supported mobile destination and an explicit exchange intent from its future route caller. Historical receipts without secure claims cannot be upgraded by retry. Unsupported/no-channel visitors must still use ordinary capture.

## Authority and storage

`exchangeClaims.ts` provides request, dispatch and verification services. Callers supply authenticated server locals, an opaque continuation, a UUID request ID and a server-resolved client address. These are internal services, not endpoints. S-403 must enforce same-origin POST/CSRF, keep the continuation in its browser-bound flow, avoid logging request bodies and never accept owner/account/destination authority from forms.

The service verifies the persisted unexpired session, exact continuation, bound account and session, selected profile publication, active origin person, both active vaults and challenge generation. Realm-scoped MACs prevent a copied DEV claim from working in a different configured realm. Six-digit random codes have a 15-minute maximum life; continuations last 24 hours. Five aggregate failures and five sends are enforced per exchange, with a 60-second resend cooldown. Resends revoke previous challenges without resetting failures.

Persistent hourly budgets: sends per account 10, destination 5, request origin 30, global 100; verification attempts per account 20, destination 20, request origin 100. Budget keys are keyed digests, with no raw IP or phone. A refusal commits counters where necessary. Expired counters are removed during request processing or maintenance.

A verified association is not a mutual Connection, access grant, identity merge or ongoing update subscription. The source contact keeps its ID and history. The recipient receives the published card snapshot in their own encrypted person and evidence records. Their existing active verified entry for the sharer is reused. Private notes and source history are never copied. A fresh origin capture that conflicts with an existing associated person is refused for reviewed recovery rather than silently merging two contact histories. Retrying the same settled exchange returns the same recipient person ID.

Self-account claim requests are refused before challenge issuance. S-403 must short-circuit self-scans before capture and return the existing self/profile experience. Archived entries and revoked associations cannot be silently revived. Conflicting verified phone associations block automatic settlement, including shared/reassigned numbers. Recovery UX is S-404.

## Delivery and concurrency

The initial controlled pilot accepts Australian mobile numbers only: `04xxxxxxxx` or `+614xxxxxxxx`, with ordinary spaces, parentheses or hyphens. Other destinations remain available for ordinary contact capture but not this pilot's SMS assurance. International expansion and email verification are follow-on work.

Delivery requires all of the following in the executing server environment:

- Existing canonical DEV origin and exact `RELISH_DEV_FOUNDATION_PILOT_TARGET` database binding.
- `RELISH_EXCHANGE_REALM`, a stable environment-unique lowercase identifier, 3-50 characters. Changing it invalidates pending continuations/proof and budget lookup; do not rotate it casually.
- `RELISH_EXCHANGE_TEST_PHONES`, a comma-separated allowlist of canonical test mobile numbers.
- Existing `TELNYX_API_KEY` and `RELISH_DORIAN_SMS_NUMBER` plus the existing encryption/MAC configuration.

No routes currently call the new writer or dispatcher. No automatic worker is started. An explicitly authorized live DEV test send and sender configuration check are still required before enabling browser delivery.

For this bounded pilot, a database-wide exchange advisory lock serializes request, dispatch, settlement and privacy controls. Account locks are sorted, followed by vault and profile checks. Session revocation and profile withdrawal serialize with use. The transaction holds these locks through the existing 12-second provider timeout; this deliberately limits throughput and can delay privacy controls. Revisit before a wider cohort. Real PostgreSQL CI exercises concurrent connections.

The encrypted outbox supports explicit retries, capped at three provider attempts per challenge. Success clears payloads; resend, suspension, expiry maintenance and erasure cancel or remove them. A provider acceptance followed by a database/process failure can deliver the same SMS more than once. Settlement remains idempotent and old-generation codes remain unusable. There is no claim of exactly-once external delivery.

## Privacy, expiry and operation

P-305 review includes exchange/card snapshots, association and challenge/delivery metadata. It excludes code MACs, delivery payloads and challenge destinations. Suspension revokes inbound and outbound associations and exchanges and cancels pending sends under the same serialization lock. Erasure deletes incoming and owned dependency rows before the private graph, retaining the other owner's independently held contact and history. Counts include dependency deletions.

The existing offline privacy command now accepts `expire-exchanges`. It requires the same explicit database target, case reference and command confirmation as other writes. For a selected owner it clears expired queued/failed delivery payloads and marks pending challenges/exchanges expired. Terminal audit records and encrypted destination snapshots remain subject to the existing reviewed erasure process. This command does not send messages.

```sh
# Use the existing verified target/env setup, and only the selected test account.
P305_CONFIRM="expire-exchanges:$account:$case_ref" node --env-file="$env_file" --import tsx scripts/foundation-privacy.ts expire-exchanges "$case_ref" "$account"
```

S-403 must invoke or schedule expiry maintenance for admitted owners before enabling the delivery flow. It must also provide bounded two-account DEV admission, same-origin browser consumption and clear recovery messages. The separately hosted backup/erasure replay remains deferred until production preparation, as requested by the operator.

## Migration and rollback

`20261107020000_s402b_exchange_service` is one additive migration after S-402a. It adds `FoundationAccountAssociation`, `FoundationClaimBudget` and a custody-checked settlement receipt on the exchange. Immutable association provenance, monotonic revocation and immutable settlement identity are enforced in SQL. No existing rows are backfilled, users enrolled or legacy data migrated. A database at 108 applied migrations / 18 foundation tables becomes 109 / 20.

```sh
# Local development only, with the intended development database configuration.
npx prisma migrate dev
```

Railway can use the already configured `start:with-migrations` / `prisma migrate deploy` after a separate merge/deployment. Application rollback leaves additive tables in place. Once claim data exists, keep a compatible privacy service for dependency cleanup; do not run an older eraser against populated exchange tables. No destructive down-migration is provided.

## Validation

`tests/foundation/s402-service.test.mjs` uses real guarded services and synthetic database fixtures, with every provider call intercepted. It covers request idempotency, reciprocal private copies, replay, account/session substitution, cumulative failures, resend generation, realm mismatch, publication withdrawal, suspension, archive/self refusal, bounded provider retries, expiry cleanup, budgets, phone conflicts, immutable records, concurrent settlement/suspension and injected late rollback. The same suite runs against disposable PostgreSQL 18.6 in CI. Existing schema, privacy and DEV-account tests run alongside it. Local validation passed 34 focused schema/service/privacy/pilot checks and 70 existing profile/capture/People/notes/transition checks, with no failures or skips. Svelte check reported zero errors and warnings. Node 24 encountered a WASM runtime crash; the focused suite passed with WASM tier-up disabled, and regression checks used Node 22, matching CI. PostgreSQL CI results belong in the PR; local tests do not establish live provider or mobile-browser acceptance.
