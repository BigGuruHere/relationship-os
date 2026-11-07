# S-402a Exchange persistence

Merged through PR #31 at development 477adb9, 2026-11-07. This is the first implementation slice of S-402. S-402b adds the guarded SMS service, account-association persistence, settlement, cross-account budgets and privacy operations before activation. S-403 connects the browser flow.

## Migration and constraints

Migration 20261107010000_s402_exchange_claims adds three tables, bringing the foundation table count to 18. It adds unique custody indexes to Profile and FoundationSource and leaves existing rows intact.

FoundationExchange binds a selected profile, captured person and CONTACT_EXCHANGE source to the same owner and vault. It stores encrypted card and destination snapshots, a hashed continuation, expiry, single-assignment beneficiary, generation and cumulative attempt/send counters.

FoundationExchangeChallenge binds account, session digest, channel, encrypted destination, keyed code digest and generation to that exact exchange. Both SMS and EMAIL are valid channel values. A unique exchange/generation pair prevents duplicate issuance. Attempts are bounded, verified/consumed timestamps are checked, and immutable identity prevents changing an issued challenge's beneficiary or channel.

FoundationExchangeDispatch binds one encrypted delivery payload to one challenge and its custody. SENDING requires a lease. Terminal delivery states require payload removal. A bounded error-code vocabulary prevents raw provider responses being persisted in this field. SQL cannot establish that application-supplied ciphertext or digests were produced correctly; S-402b's service must provide and test encryption, keyed hashing and secret handling.

Composite foreign keys reject cross-owner references and restrictive deletion requires explicit cleanup. Mutation triggers protect custody, exact exchange evidence, challenge binding and terminal states. At the S-402a merge, application capabilities denied all three models. The subsequent [S-402b service branch](S402_EXCHANGE_SERVICE.md) adds narrow writer/privacy capabilities and another additive migration; ordinary application access remains denied.

The provisional per-exchange limit is five verification failures and five sends, matching the design's five attempts and making bounded resends concrete. Changes to these limits require a reviewed migration. Generation checks and expiry comparisons at the moment of use, concurrent budget enforcement, dispatch authorization, verified account associations and atomic reciprocal settlement are S-402b obligations.

## Validation

Local acceptance passed all 30 S-402a/F-202 checks with zero skips. Prisma schema validation passed and Svelte check reported zero errors and warnings. Seventy-three documentation links were verified. GitHub CI status is recorded in the PR.

The new embedded PostgreSQL suite applies F-202, snapshots every existing table's rows, applies S-402a, and compares all prior rows. It tests ownership/type mismatches, account substitution, duplicate generations, immutable proof fields, attempt limits, delivery cleanup and application guard denial. It injects a late migration failure on a separate disposable database and checks transactional rollback. The existing F-202 suite exercises its own historical migration independently.

Run with Node 22 and installed dependencies.

```sh
# Validate the new additive migration and historical foundation invariants.
node --test tests/foundation/s402-schema.test.mjs tests/foundation/f202-schema.test.mjs
```

## Applying and recovering

A Prisma migration is required. For the local development workflow, use the normal development database configuration.

```sh
# Apply the pending development migration through Prisma.
npx prisma migrate dev
```

Railway's existing start:with-migrations runs migrate deploy when this branch is separately merged and deployed. There is no data backfill or account enrollment in this migration. Expect 108 applied migrations on an environment previously at 107, and 18 foundation tables. Confirm the exact target before execution.

A compatible prior application can operate with the empty additive tables. Keep them during application rollback. The next slice must integrate review, suspension, erasure and delivery cancellation before any claim writers become available. Once populated, retention and dependency handling require the reviewed service workflow. Hosted recovery remains deferred per the operator's decision.
