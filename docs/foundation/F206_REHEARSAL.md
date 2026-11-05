# F-206 internal integration and transition rehearsal

Branch `feature/f206-transition-rehearsal` starts from development `8d895f8`, the merge of F-205 PR #18. DEV smoke confirmation for F-204 and F-205 is still pending.

## Run the rehearsal

Run `npm run check:foundation:rehearsal` on Node 22. The test creates its own in-memory PostgreSQL database, real generated legacy tables, the default-home trigger and the F-202 migration. It uses synthetic accounts and sets the database URL to its disposable socket. The companion concurrency check runs in the foundation CI job against a separate empty PostgreSQL 18.6 server.

The test creates and verifies real first-party sessions for the synthetic users. It exercises production service calls, the My People and Brokerage page loaders and the public capture persistence adapter. The existing onboarding tests cover form validation, consent, download and return-visit behavior. Physical-device and deployed DEV checks belong to the release record.

| Account state | Rehearsed behavior |
| --- | --- |
| Legacy | QR submission writes a private Contact and provenance receipt. Repeating the same nonce yields one entry. Brokerage lists its original business Contact. |
| PREPARED | Public capture still uses the legacy private home. A signed-in visitor can submit under the recipient's custody. A synthetic transition with existing private Contacts or Interactions stops for a data handoff. |
| ACTIVE | An authenticated owner creates a private person, relationship and attributed perspective. A single note concerns the person and the relationship. A second enrolled owner is denied access to the relationship, excerpt and statement. Legacy public capture rejects this destination pending P-302. |
| SUSPENDED | Current foundation operations and legacy capture fail closed. Brokerage still reads its original record. Resuming with a new epoch restores access to the corrected statement and private directory using fresh authority. |

## Writer handoff and recovery

The transition driver is fixture-only. Its account lock, expected prior state and epoch compare-and-update exercise a controlled handoff. The test assumes other legacy private writers have been paused and drained. Its empty-private-data check covers the Contacts and Interactions in the fixture. An actual account with existing private data needs a separate complete inventory, mapping, verified copy and a write pause before activation.

Capture now takes the account lock inside its existing database transaction, before the profile receipt lock. It resolves the published profile owner's current domain and creates the private home on that same connection. Read-committed isolation ensures a waiting capture sees a handoff that committed while it waited. The regression tests cover a stale preflight, repeat submission, and rollback of first-home creation when publication is withdrawn before persistence.

Before a future handoff, record the prior state/epoch, verify recovery and pause/drain all affected private writers and jobs. After foundation writes, suspend the account under the account lock and advance its epoch. Keep its vault, source versions, directory, evidence and legacy records intact. Verify old handles are denied. Repair the cause and resume under a fresh epoch with a verified compatible reader/writer. Confirm the corrected statement and original Brokerage record by ID. Changing the account back to legacy storage after new writes requires a separately designed reverse migration.

## Release scope

F-206 ships the repeatable rehearsal and capture transaction fix. It requires zero new Prisma migrations. Cohort activation, data copying and invitations remain separate operator decisions. P-301 adapts the existing directory and person details. P-302 supplies the foundation public intake adapter. Invited rollout stays gated on P-305/P-306 operations, privacy and device acceptance.

## Acceptance record

[PR #19](https://github.com/BigGuruHere/relationship-os/pull/19) targets development. [Foundation CI run 41957382850](https://github.com/BigGuruHere/relationship-os/actions/runs/41957382850) passed all 95 reported tests with zero skips on implementation commit `7b606c2`. This includes the full disposable database journey and the PostgreSQL 18.6 lock-wait test. Locally, 22 focused People, capture and onboarding regressions passed and Svelte reported zero errors and warnings. Review, merge and the DEV smoke check remain the integration gates.
