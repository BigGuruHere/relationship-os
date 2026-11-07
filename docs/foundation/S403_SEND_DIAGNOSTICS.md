# S-403 send diagnostics

Feature branch `fix/exchange-send-diagnostics`, based on development `d19c12c` (merged PR #34), 2026-11-07. No Prisma migration, deployment, database write or live SMS was performed.

## Report and confirmed findings

After the native-form fix, the operator reports a generic 400 immediately on Send, before receiving SMS. This reaches a later service check, but the current deployed route suppresses its cause. The live cause is **not established**. The operator reports matching contact/configured numbers in different formats. The existing service already canonicalizes Australian `04xxxxxxxx` input to `+614xxxxxxxx`; using the same number for both test contacts does not prevent initial challenge sending. A conflicting verified account association is evaluated later during settlement.

## Instrumentation

Exceptions now emit one structured `relish.foundation.exchange` event with a random support reference, operation (`request`, `dispatch`, `verify`), a fixed reason, and the existing sanitized Prisma code/category. The page displays only the reference and its generic error. Failed provider dispatch results also emit a reference. No phone, code, token, cookie, session/account/profile ID, IP, SQL, provider response or raw exception message is logged.

Reasons distinguish session rejection, missing continuation/exchange, self exchange, source/claimant lifecycle, beneficiary mismatch, withdrawn profile, archived contact, inactive/expired exchange, stale challenge, attempt limits, missing destination, DEV binding and test-phone configuration. Generic guard or unexpected failures remain classified without copying their message. Unexpected database errors retain only recognized Prisma codes, for example P2028 for a transaction timeout.

The destination allowlist now applies the same strict Australian normalizer after trimming comma-separated entries. This tolerates spaces and local/international notation for the **same** number. Invalid entries fail closed with `TEST_PHONE_CONFIG_INVALID`; an unlisted canonical destination remains blocked. This does not permit new countries or bypass the DEV gate, assurance or abuse limits.

## Operator follow-up

After merge and DEV deployment, refresh the claim page and reproduce once. Match the on-page Support reference to the Railway JSON line whose component is `relish.foundation.exchange`. Share that single sanitized event to diagnose the failed check; no credentials or full database logs are needed. Do not change account ownership, unlock lifecycle states or disable guards to make the request pass.

- `EXCHANGE_NOT_FOUND`: check environment/realm consistency and whether this browser's exchange exists in the deployed database.
- `SOURCE_ROOT_INACTIVE` / `CLAIMANT_ROOT_INACTIVE`: inspect the intended controlled cohort rather than enrolling an existing account automatically.
- `DESTINATION_NOT_ALLOWED` / `TEST_PHONE_CONFIG_INVALID`: verify the deployed Railway allowlist, not just a local .env file. Do not print its values.
- `CHALLENGE_EXPIRED`: request a new code within the existing limits; use a fresh exchange when its continuation has expired.
- `UNEXPECTED_FAILURE`: use only the sanitized category/code and reference for further source investigation.

Diagnostics narrow the failure; they do not establish that a live send has been fixed. The first post-deployment reproduction and any successful approved SMS remain operator evidence to record.

## Validation

Focused tests cover correlated page/log references, fixed log fields and exclusion of private values, local-format contacts against formatted international allowlist entries, blocked destinations without a provider call, plus existing claim replay, lifecycle, concurrency and rollback behavior. The full CI suite also runs real PostgreSQL and Chromium forms. Exact results belong in the PR. Application rollback requires no schema operation.
