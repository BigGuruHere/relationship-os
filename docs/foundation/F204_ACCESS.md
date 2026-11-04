# F-204: Owner-private authorization and repositories

Updated: 2026-11-05. Feature branch `feature/f204-foundation-access-20261105`, based on development `bdd5ef874cd63a64450950861702d46ecde5a2fd` (PR #16 merge). Pending merge and deployment. No activated users, public route changes or new migration.

## Existing capability and gap

F-202 supplies database integrity, not caller authorization. F-203 separates enrollment/provisioning from legacy account claims. Existing ContextSpace guards protect legacy models only. This stage reuses the shared Prisma client, authenticated server locals, encryption primitives and F-203 account lock to introduce the missing private-domain authorization boundary.

## Implemented contract

- `policy.ts`: resolve owner from authenticated server locals, not form-supplied owner/vault. Issue an immutable in-process access handle with actor, owner, vault, operation, fixed PRIVATE_DIRECTORY purpose and enrollment epoch. A copied, forged or serialized handle is denied. Resolve fresh from authenticated locals for each request; do not cache handles across requests or treat them as session tokens. No visitor, agent, administrator-on-behalf-of-owner or job delegation is available.
- Default resolution requires ACTIVE enrollment. A separate internal-only resolver supports PREPARED synthetic rehearsal; no shipped route calls it. No enrollment or activation endpoint is added.
- Every repository operation, including reads, reacquires the F-203 account advisory lock and vault row lock, then checks current enrollment, epoch, vault state and self-subject root. SUSPENDED, missing/locked/deleting roots and stale handles fail closed. Transitions must take the same account lock and increment epoch; direct privileged SQL outside that protocol is not an authorized transition path.
- `subjects.ts`: create/read/list/archive private people, create relationships/groups with validated same-owner active PERSON members, read protected member projections, and create owner-recorded/attributed/AI perspectives. Relationships require two distinct members; groups one. Creation is atomic and bounded to 50 members. Membership and attribution confer no disclosure rights or mutual acknowledgement. Archiving a subject hides it from normal reads and relationship member names; self cannot be archived through this service.
- Directory pages are bounded to 50 before decryption with keyset continuation. No global name/email matching, text search, copying of profile fields or identity-link inference. Names use existing AES-GCM with owner/vault/row AAD.

## Prisma boundary

The base Prisma client remains private inside `db.ts`. The shared extension rejects unscoped Foundation model operations, including count and bulk operations. Inside an authorized transaction it injects owner/vault filters and rejects nested relation reads, filters, writes and includes. Compound unique lookup keys remain top-level when adding custody predicates. User-to-foundation relations, including nested `_count`, are denied through legacy queries. SQL CHECKs and compound FKs remain independent integrity defenses.

Only the reviewed provisioning/policy modules can establish internal scope. Prisma lazy queries must be awaited inside that scope. Scope expires on return, including asynchronous descendants; escaped transactions/serialized access objects cannot become a reusable authorization channel. Architecture tests constrain capability imports and extra Prisma client construction.

Raw foundation SQL is rejected except the fixed internal lock operations. Existing legacy SQL remains a reviewed server-code facility, not a user query interface. This guard is not a SQL sandbox, database RLS or protection against malicious server code/privileged database credentials. Never pass user SQL or interpolate identifiers. Adding new raw SQL requires review; new foundation repositories use bounded scalar queries rather than raw traversal. Source/schema maintenance tools remain separately authorized operations.

Foundation evidence, statements, supports, semantic contexts and their associations remain denied by the domain guard until F-205 implements their version/admission/eligibility contract. No permissive repository or processing stub is shipped. New background jobs must gain an explicit server authorization mechanism and persist domain/vault/epoch before introduction; possession of a serialized handle is insufficient.

## Validation and release evidence

- Node 22 local: F-204 has nine passing tests and one standard-server concurrency test skipped; F-203 has 19 passing tests and two standard-server races skipped. CI runs all three races on PostgreSQL 18.6. Svelte check: zero errors and warnings.
- Actual shared Prisma client and actual repositories are exercised against the F-202 migration. Tests include direct/nested/raw bypass attempts, forged/copy handles, operation mismatch, cross-owner reads/lists/members/perspectives, archive/self protection, ciphertext custody, expired asynchronous scope and stale enrollment/epoch/vault state.
- PostgreSQL concurrency test holds a real repository transaction, observes an enrollment transition blocked on its account lock, commits the transition and verifies the old handle is denied. Verified by [CI run 41911636542](https://github.com/BigGuruHere/relationship-os/actions/runs/41911636542) on code commit `77c0d0ba9791c3cab750dd86c30df65681dd9a5f`: all ten F-204 tests pass, zero skipped. The same PostgreSQL 18.6 run passed 21 F-203 tests and 48 F-202 schema/concurrency tests, 79 total.
- Legacy regression suite: 55 pass, six failures. All six reproduce on unchanged development `bdd5ef8`: magic-link User creation expectation, three older ContextSpace schema count/guard expectations, public-profile already-connected source expectation and legacy cross-owner source-boundary expectation. Tests are not weakened.
- No live database, external provider or deployed browser checks are claimed for F-204. F-203 DEV login/People/share smoke success was separately confirmed by the operator.

## Migration, rollout and rollback

No Prisma migration required. F-202 tables and F-203 must already be present. No route is switched to these services; legacy People, QR, Brokerage and voice remain on their existing paths. Restart a local dev server when adopting a changed Prisma extension so its cached client uses the new guard.

Merge/deploy does not authorize preparation or activation. F-205 supplies versioned evidence and statement operations; F-206 proves integration and transition before the stage-3 user pilot. Erasure/export and retention readiness remain release gates. Keep existing isolation guards on rollback; after any enrollment/new writes, never route an account to stale legacy storage or drop foundation tables to undo application changes.
