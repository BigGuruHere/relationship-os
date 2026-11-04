# F-203: Account provisioning isolation

Updated: 2026-11-05. Implemented on `feature/f203-provisioning-isolation-20261105`, based on development `2d6d1a3`. Merged via PR #16 at `bdd5ef8`. Operator confirmed DEV login, My People and share checks passed on 2026-11-05; exact running Railway SHA is not independently attested. No cohort activation.

## Existing capability and change

All four supported authentication paths already use `createSession`: password registration/login, Google callback and magic-link verification. Reuse that boundary after credential verification and before session creation. Shared User, Person, Profile and legacy ContextSpace creation remain intact. No browser-supplied domain flag grants enrollment.

`server/foundation/provisioning.ts` reads server-managed FoundationEnrollment. No row means LEGACY. An internal `prepareFoundationAccount` transaction creates PREPARED enrollment, one PRIVATE_HOME vault and one encrypted PERSON self subject. It has no shipped route or signup caller. Repeated calls return the same roots. Vault locks, archived subjects and inconsistent roots fail closed. ACTIVE sessions require existing complete roots; SUSPENDED accounts can authenticate without repair or reactivation.

Every enrollment state, including PREPARED, skips automatic legacy email/phone/LinkedIn lead claims and reciprocal contacts. This deliberately separates claim side effects from public routing: PREPARED still uses existing People/capture routes during internal preparation. ACTIVE and SUSPENDED private People routes and anonymous capture destinations fail closed until F-204/P-301 provide the new path. Brokerage and existing voice workflows remain legacy.

## Transaction contract

Preparation, session provisioning checks and legacy claims take the transaction advisory lock keyed by `foundation:account:<userId>` using `hashtextextended`. All future enrollment transitions must use the same key, increment epoch and enforce the F-204 write handoff contract. The claim callback uses the same Prisma transaction connection, including legacy custody checks, so a one-connection pool cannot deadlock by requesting another connection. Reciprocal-contact errors roll back to a savepoint without losing successful primary claims.

The self label is neutral `Me`, not imported legacy/profile content. Ciphertext AAD is `foundation:v1:FoundationSubject:displayNameEnc:<owner>:<vault>:<row>`. This helper is a narrowly reviewed internal provisioning boundary, not permission to expose unguarded foundation repositories or arbitrary model access.

## Validation

- Node 22: 19 provisioning/authentication tests pass locally. Real handlers exercise registration, password, Google and magic-link success and provisioning failure, credential rejection and authenticated LinkedIn dispatch. Provider and account boundaries are synthetic; no live provider login is claimed.
- Embedded PostgreSQL runs actual provisioning/session/linker code with the F-202 migration: repeatability, rollback after partial preparation, custody-bound encryption, invalid-root rejection, suspended behavior, all enrolled claim skips and private routing. The one-connection callback test covers transaction connection reuse.
- Two additional tests require explicitly named empty loopback PostgreSQL: concurrent preparation and an observed blocked preparation behind an in-flight claim. The Foundation database CI workflow runs these on PostgreSQL 18.6; local embedded runs explicitly skip them. Verified in [CI run 41898613496](https://github.com/BigGuruHere/relationship-os/actions/runs/41898613496) on code commit `6fe087ed66adc2c358026dd92ffb984f09cb51a3`: all 21 F-203 tests passed with zero skipped, plus 23 F-202 schema and 25 F-202 concurrency tests.
- Focused existing suite: 33 pass / 3 fail; expanded ContextSpace audit: 22 pass / 3 fail. All six failures reproduce on unchanged development `2d6d1a3`: three stale schema count/guard expectations, the magic-link User-creation expectation, and two legacy public-profile/cross-owner source expectations. These tests were not weakened or changed. Profile-onboarding, My People and public-capture tests pass.
- Svelte check: zero errors and zero warnings. `git diff --check` passes.

## Rollout, migration and next stage

No Prisma migration in F-203. F-202 must already be installed before this code runs because authentication now reads its enrollment table. DEV F-202 deployment and login/People/share smoke checks were confirmed by the operator; no PROD rollout is claimed.

Do not invoke the preparation helper for real accounts as part of deployment. No accounts are enrolled automatically. F-204 implements guarded repositories and state/epoch enforcement; F-205/F-206 deliver the private evidence slice and integration proof. Stage 2 remains open and stage 3 user rollout remains gated.

With no enrolled accounts, application rollback can return to the prior version while retaining additive tables. After any enrollment, do not roll back to code that resumes automatic legacy claims or returns ACTIVE users to legacy storage. Keep isolation guards and disable affected writes while rolling forward. Do not drop foundation tables or erase enrollments as a rollback technique.
