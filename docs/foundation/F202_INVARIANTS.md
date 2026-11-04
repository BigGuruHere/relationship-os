# F-202 database invariants and rehearsal

Date: 2026-11-04. Branch: `feature/f202-foundation-schema-20261104`, based on development `c3eb501dfaf9eb83339b127cfff570ab0b365646` (PR #14 merge). Status: implemented and validated in an isolated embedded PostgreSQL rehearsal; not merged, not deployed to DEV/PROD, and not activated for users.

## Implementation boundary

The additive migration is [20261104010000_f202_foundation_schema](../../prisma/migrations/20261104010000_f202_foundation_schema/migration.sql). Its table/enum/FK definitions are represented in [Prisma](../../prisma/schema.prisma); the SQL-only invariants below are part of the same transaction. It creates 15 Foundation tables and 14 Foundation enums, with three inverse relations on User. It does not alter existing database tables, seed enrolment, backfill records or modify any runtime route/service.

The generated Prisma client exposes these models, but it is NOT an application access boundary. F-203 enrolment/auth isolation and F-204 scoped access guards remain mandatory before any route or agent uses them. No foundation reader/writer is enabled by this stage. Existing ContextSpace guards and legacy authentication side effects are unchanged.

## SQL invariant manifest

| Invariant | Persisted mechanism | Behavioural coverage |
| --- | --- | --- |
| Same owner and vault | `f202_fk_1` through `f202_fk_36`, custody UNIQUE keys | Wrong-owner vault and cross-owner evidence subject rejected through SQL and Prisma |
| Typed subject references | `f202_subject_typed` composite key plus member/speaker/perspective discriminator CHECKs | Relationship masquerading as PERSON rejected; nullable discriminator loopholes rejected |
| Self subject | `f202_subject_self_shape`, `f202_subject_self` | Other-account self reference and duplicate self rejected |
| Membership episodes | `f202_member_shape`, partial `f202_membership_active` | Duplicate active membership rejected, historical leave/rejoin allowed |
| Explicit perspective | `f202_perspective_shape` | Attributed person requires a typed holder; owner perspective cannot carry an attributed holder |
| Source/statement version lineage | `f202_source_lineage_shape`, `f202_statement_lineage_shape`, compound previous-version FKs and number UNIQUE keys | NULL predecessor number, wrong parent, duplicate version and invalid temporal range rejected |
| Statement temporal range | `f202_statement_validity` | End before start rejected |
| Evidence/record immutability | `f202_immutable_fields`, `f202_immutable` triggers on all 15 tables | Version text, evidence, perspective, custody and immutable key updates rejected; allowed root state changes work |
| Enrolment staleness | `f202_enrollment_epoch`, `f202_enrollment_epoch_guard` | State changes require higher epoch; epoch cannot decrease |
| Replay uniqueness | Source ingest key and segment anchor UNIQUE keys | Duplicate source/segment key rejected; API payload equality handling remains F-204/F-205 work |
| Support target and uniqueness | `f202_support_shape`, partial `f202_support_segment` / `f202_support_input` | Missing/both inputs, self-input and duplicate edges rejected |
| Derivation acyclicity | `f202_graph_lock`, `f202_no_cycle`, ordered triggers | Direct SQL cycles rejected; 24 overlapping-session race cases passed on PostgreSQL 17.11; target-version parity remains required |
| Complete statement versions | Deferred `f202_complete` triggers and `f202_assert_complete` | Missing aboutness/support fails at COMMIT; valid transactional construction succeeds; final-edge removal and unsupported reactivation rejected |
| Context associations | `f202_context_target`, partial `f202_context_segment` / `f202_context_version` | Missing target/duplicate association rejected; no grants inferred |
| Restrictive erasure | ON DELETE RESTRICT references | User deletion blocked while foundation records exist; ordered removal of a DELETING statement retains independent evidence |

Integrity functions pin `search_path` to `pg_catalog, public, pg_temp`; the cycle test also attempts temporary-table shadowing. All compound references use ON UPDATE RESTRICT. Common owner/vault IDs, row IDs and createdAt are immutable. Membership allows role/leftAt updates; Subject allows private presentation/state updates; root Source/Statement allows state/updatedAt; Context allows label/description/state; other version/evidence/edge rows reject content updates. A no-argument immutability trigger explicitly coalesces NULL TG_ARGV to an empty array. Without that, PostgreSQL NULL semantics would bypass the comparison; the rehearsal caught this and the regression now covers it.

The graph lock updates the vault's updatedAt rather than only taking a row lock. This gives a conflicting row version under repeatable-read/serializable isolation so stale graph writers must retry, and serializes mutations affecting deferred completeness. It does not confer actor authority. Application transactions will need consistent lock order and retry handling in F-204/F-205. New versions require complete evidence even if their root is DISABLED; reactivation checks existing versions too. Physical deletion remains an explicit service workflow, not a grant implied by these FKs.

## Reproducible isolated rehearsal

With Node 22 and installed development dependencies:

```sh
# Generate the client from the checked-in schema; this does not migrate a database.
npx prisma generate
# Run the synthetic embedded PostgreSQL rehearsal; it ignores DATABASE_URL.
npm run check:foundation:schema
# Check application types and Svelte diagnostics.
npm run check
```

[The test](../../tests/foundation/f202-schema.test.mjs) uses pinned development-only PGlite, pgvector and socket packages. It creates its own in-memory PostgreSQL engine, constructs the current 103-model legacy schema without Foundation additions, installs the actual legacy User default-ContextSpace trigger, and inserts synthetic fixtures. No real record content, credentials or database endpoint is used. A temporary loopback listener permits a generated Prisma client smoke test; it closes afterward. This is an unguarded test client, not an example of production authorisation.

The fixture includes two owners, private and business custody, public profile, contacts, note, pending Lead, relationship membership and a Contact-bound LU revision. The test snapshots EVERY legacy table's rows before migration and compares them afterward and after adversarial operations. It dumps/restores the embedded pre-migration database, injects a failure after DDL to verify transaction rollback, reapplies the migration and checks that no enrolment/backfill appeared. The physical snapshot exercises the isolated engine's restore mechanism, not Neon backup recovery.

## Results and limits

- Prisma schema validation and generated client: passed.
- Isolated PostgreSQL rehearsal: 23 tests passed (22 subtests plus parent), including SQL and Prisma constraints, restore/replay and atomic failure recovery. Initial application of the additive migration took approximately 0.1 seconds on the embedded engine; this is not a production timing estimate.
- Existing capture, My People, access-policy and onboarding regressions: 28 passed using synthetic test secrets. An initial attempt lacked required test secrets; rerunning with explicit synthetic values passed without code changes.
- Node 22 Svelte/TypeScript check: zero errors and zero warnings.
- Documentation validation: all 65 local links across 15 documents resolve; dependency lock consistency and `git diff --check` passed.
- No full application suite, browser/device check, target database query or deployment was performed. There is no UI change in this stage.

An additional empty-database replay of historical migrations applied six old migrations then stopped at `20251008141349_make_password_hash_nullable_for_oauth` with missing index `interaction_vec_hnsw` (SQLSTATE 42704). This predates F-202. No old migration was edited. Therefore the rehearsal uses the current schema plus the actual default-space trigger, not a claim that all 106 historical migrations or custom triggers replay cleanly from scratch. A target database's actual applied history and custom constraints still require inspection.

PGlite has one underlying connection. Its socket multiplexer is adequate for the sequential Prisma smoke test, but does not validate true multi-session locking or concurrent transaction races. The CI follow-up below now covers cases 1-4 on PostgreSQL 17.11. Confirm the target version and repeat on that version if different; case 5 remains outstanding before target migration/cutover:

1. Two writers add opposite derivation edges. At most one commits; the other rejects a cycle or retries serialization before reevaluation.
2. Two writers remove different supporting edges. At least one support remains for every ACTIVE version; one writer must fail if both removals would orphan it.
3. Concurrent same-source version appends and same-ingest-key submissions. Exactly one version/key wins; losers produce retry/conflict rather than duplicate records.
4. Repeat those cases at READ COMMITTED and REPEATABLE READ, and retry 40001/deadlocks through the future service contract.
5. Run target aggregate inventory, migration-history parity, backup/restore and no-new-legacy-side-effects checks before activating routes.

Target readiness and target-version parity remain explicit release gates. They do not require user activation or live private data to test. F-202 has shipped schema and isolated sequential integrity evidence; stage 2 remains open through F-203 to F-206.

## Migration and rollback instructions

A Prisma migration is required when this code is deliberately installed into a database. Do not run it merely to read these docs. For an explicitly selected disposable/local development database, the normal stage command is:

```sh
# Apply only to the deliberately configured development database after inventory review.
npx prisma migrate dev
```

DEV/PROD migration execution remains a separate authorised step. The application's existing `start:with-migrations` runs `prisma migrate deploy`; account for that before promoting this branch to an automatically deployed environment. Do not equate Git merge with a completed migration or verified deployment.

The migration wraps DDL and invariants in one transaction, so failed application rolls back. Once applied, leave dormant additive tables in place when rolling application code back. If later stages have written foundation data, lock the new path and roll forward or execute a separately rehearsed recovery; never drop tables or fall back to stale legacy records as routine rollback.

## Concurrent-session CI follow-up

PR #15 remains unmerged. The [PostgreSQL CI workflow](../../.github/workflows/foundation-database.yml) runs the embedded rehearsal and [concurrent-session tests](../../tests/foundation/f202-concurrency.test.mjs) on a disposable PostgreSQL 17 service. Four race cases repeat three times at READ COMMITTED and REPEATABLE READ. Each case verifies that the second writer actually blocks on the first; serialization failures are retried to verify graph invariants against a fresh snapshot. The driver pg 8.16.3 is installed only in CI without changing the application lockfile.

Status: passed on 2026-11-04. [CI run 41750250776](https://github.com/BigGuruHere/relationship-os/actions/runs/41750250776) tested commit `bae36c2c0838e9f9f67bd2d754e0b9bb7c61fa46`: 23 embedded rehearsal tests and 25 concurrent-session tests (24 subtests plus parent), zero failures, PostgreSQL 17.11. Opposite edges and final-support removals rejected with 23514 at READ COMMITTED; REPEATABLE READ rejected with 40001 and fresh-transaction retries rejected with 23514. Competing versions and ingestion keys rejected with 23505. This is not target-version parity, target inventory, migration-history review or backup/restore evidence. No target credentials are used and no DEV/PROD migration is authorized by this workflow. The target readiness runner remains unpublished pending validation.

## Development database readiness, 2026-11-04

Operator-provided read-only metadata reports PostgreSQL 18.6 and no Foundation tables. All 106 recorded migrations finished successfully, with no rolled-back or unfinished attempts. All migration names exist in the PR and the only pending migration is F-202. Of 106 checksums, 105 match repository bytes exactly; `20261031110000_stage8_22_unified_policy_sms` matches the repository SQL with CRLF line endings exactly (database checksum `244a9c36d550297e9a7095667b6fdcd0d82a57ef3d903c3527777d81be61e23a`). This is an identified line-ending difference, not evidence of a SQL content change. No migration file or database history has been rewritten.

The CI service now targets PostgreSQL 18.6. [CI run 41753717094](https://github.com/BigGuruHere/relationship-os/actions/runs/41753717094) passed on code commit `eeac8e44e268b8e7ac94da325dd58477d279e754`: 23 embedded schema tests and 25 concurrent-session tests, zero failures. The job confirmed PostgreSQL 18.6. This tests standard PostgreSQL, not Neon-specific configuration. Target aggregate inventory, schema drift/custom object review and backup/restore remain unverified. PR #15 remains unmerged; no target database mutation has occurred.

## Development aggregate inventory reviewed, 2026-11-04

Operator-supplied results from `scripts/foundation/inventory-readonly.sql`: 9 Users, 12 Persons, 7 Profiles, 17 ContextSpaces, 28 Contacts, 127 Interactions; 0 Leads, Relatings, RelatingParticipants or GovernedUnderstandingScopes; 22 LivingUnderstandingRevisions, 75 LivingUnderstandingTopicVersions, 2 KnowledgeClaims and 2 KnowledgeEvidence rows. Contact custody buckets: business 5 / 4 owners; other 16 / 5 owners; private 7 / 1 owner. Account-linked Contacts: 13; person-linked: 13; profile-origin: 6. Migration outcomes: 106 applied, zero unfinished/rolled back.

All reported custody mismatch, account/person disagreement, missing Person reference and duplicate private-home metrics are zero. Exception: **3 Contacts have a non-null linkedUserId with no matching User**. Current Prisma represents linkedUserId as an optional scalar without a User relation. Cause is unverified; do not infer account deletion, repair automatically, or treat the links as verified identity. Record this as pre-existing legacy data quality to resolve before any reuse/backfill of those links. F-202 does not read, change or backfill Contact rows, so this finding alone is not a structural blocker to its dormant additive schema migration.

Inventory is aggregate evidence, not a complete schema-drift/security audit. Recovery checkpoint and recovery rehearsal remain outstanding; no target migration, activation or merge has occurred. Next operator step: create an isolated Neon child branch from current development data for migration rehearsal, retaining the existing development branch unchanged.
