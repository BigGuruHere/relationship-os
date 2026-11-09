# Disposable account reset and Brokerage retirement

Status: implemented on `feature/account-reset-brokerage-cleanup`, based on Development `7e4b3259` (PR #50). No hosted database has been accessed or reset, no merge/deployment performed, and no external configuration changed. No Prisma migration is required.

## Authorised scope and boundary

On 2026-11-09 the operator confirmed that Brokerage is tested on a separate branch, deployment and database, and reported Neon snapshots of both Relish environments. They authorised removal of all development test accounts (1 LEGACY owner, 9 LEGACY members, 8 ACTIVE members) and Brokerage cleanup. Production is a later repetition after DEV acceptance with its own fresh inventory. Snapshots were reported, not independently inspected.

The existing P-305 operation erases one Foundation vault but intentionally retains the login account and routing tombstone. It does not free the email, remove Google provider subjects, or remove legacy records. The new operation is an **empty-install reset for a database containing only disposable data**. It is not a user-facing account-deletion feature and must never be used for an individual request in a populated service.

## Code removed and retained

- Remove 107 retired route files: commercial CRM, leads/import, companies, deals, projects, workstreams, tasks, actions, search, commercial agents, old Contacts, wants/offers/introductions, reminders/reconnect and guest lead intake. Retain a permanent 404 guard for old paths, including encoded matched routes.
- Remove automatic lead matching and reciprocal CRM writers from password, Google and magic-link authentication. Ordinary Foundation provisioning, Google subject identity checks, sessions and exchange continuation remain.
- Remove commercial agent runners and their built-in definitions/tool grants, Brokerage navigation, grant options, counters and feature switch. Setting the old `RELISH_BROKERAGE_ENABLED` variable cannot revive the feature. Retain shared agent policy/runtime, Dating extraction and Dorian operator tools.
- Remove lead/task-specific helpers, their exclusive acceptance tests and obsolete package commands. Mixed test files retain assertions for shared identity, custody, source admission, knowledge and agent permissions. Explicit retirement tests replace the expectation that deleted screens remain available.
- Retain historical migrations and the current schema. Company/Deal/Task and relationship models still have shared agent, interaction, provenance and custody consumers. Removing those structures requires removing or adapting those consumers; do not drop tables merely because a commercial screen disappeared. The old Lead table remains inert in this slice. The reset clears all their test rows.
- Preserve current onboarding, unpublished profiles, QR/public cards, reciprocal exchange and channel assurance, My People, private notes, password recovery and the mobile editor changes from PR #50.

This release is not compatible with running Brokerage. That application must remain on its separate branch/release.

## Reset procedure in Neon

1. Deploy the reviewed Relish cleanup to DEV through the usual PR workflow. Confirm the selected Neon project and **development branch** independently. The database name alone does not identify a Neon branch. Keep the operator snapshot and recovery details.
2. Run [`inspect-test-reset.sql`](../../scripts/maintenance/inspect-test-reset.sql) on that branch. It is read-only and reports aggregate counts, an opaque account-set fingerprint, local agent/binding counts and unfinished migrations. No emails, phones or token values are returned.
3. Review the impact: this reset removes **all 128 application tables' rows**, including every account, public profile/slug, private person/note, old CRM record, session, Google link, verification/challenge record, pending dispatch, event/consent history, user-owned agent definition and provider binding. Cached Dorian configuration is also cleared. External agent-management configuration, SMS/email provider records and snapshots are outside its scope. A local provider binding must be configured again if that integration is used. Any deployment configuration that names a deleted owner ID must also be reviewed before enabling Dorian again; this change does not alter external configuration. Schema, extensions and `_prisma_migrations` stay intact.
4. Open [`reset-test-accounts.sql`](../../scripts/maintenance/reset-test-accounts.sql). Fill `REPLACE_DATABASE_NAME` and `REPLACE_ACCOUNT_FINGERPRINT` from the inspected target; set the expected account count to the observed count (18 in the supplied DEV inventory); replace `REPLACE_CONFIRMATION` with `ERASE ALL DISPOSABLE RELISH DATA`. Keep the final `ROLLBACK` for the rehearsal. Run the **whole script together** and confirm all `after_rows` are zero. Rollback restores the records.
5. Stop the application and background workers for the committing run so there are no requests/provider jobs crossing the reset. Run the inventory again if accounts changed. Run the same reviewed script with only its final `ROLLBACK` changed to `COMMIT`. Locks, a stale fingerprint, an unexpected table, an unfinished migration or an unreviewed external FK cause failure, not a partial erase. Do not disable constraints or add `CASCADE` to bypass a failure.
6. Restart the application/workers to clear process-local note jobs and cached session state. Confirm the inventory shows zero accounts and unchanged migration history. Old profile/QR links intentionally stop resolving. Create your preferred account through normal password or Google signup; it will be ACTIVE with an unpublished profile and an empty My People.
7. Identify the new account's exact `User.id` in Neon. You can edit its `User.role` from `member` to `owner`, or use [`restore-owner.sql`](../../scripts/maintenance/restore-owner.sql), replacing `REPLACE_NEW_USER_ID` and changing the final `ROLLBACK` to `COMMIT` after rehearsal. The script refuses an existing owner or a target that is not an ACTIVE member. It changes only that account's role and timestamp. Never edit encrypted email fields, identity indexes or enrollment state. Refresh/sign in again to update the menu. Public signup never automatically promotes the first registrant.
8. Test password and Google sign-in, publication, QR/share, guest exchange, email/SMS verification, private People, voice note transcription/summary/retrieval and recovery on DEV. Local tests simulate providers and do not replace this device/delivery check.

Production has not been reset by this work. Repeat only after the DEV flow works and the operator selects the production branch and reviews its fresh disposable-data inventory. Do not reuse DEV's count/fingerprint or infer that a snapshot permits wiping a populated service. No whole Neon project/database needs to be deleted.

## Validation and rollback

The P-306 isolated database suite runs the actual SQL: missing confirmation, wrong database, stale inventory, unfinished migration, unknown table, FK outside the reviewed schema, injected truncate failure, rollback and commit. It checks all application tables are emptied and migration rows unchanged, rejects old sessions, registers the same password email and Google subject again, and exercises guarded owner restoration without changing ACTIVE enrollment. Existing private People/exchange/note/custody suites remain part of validation.

Local validation on Node 22.16.0:

- Foundation suites: 161 passed, 0 failed, 7 skipped. The skipped checks need a separate standard PostgreSQL server. The separate F-202 concurrent-connection suite also requires a loopback PostgreSQL server and was not run successfully here; CI supplies it. No protection was disabled to make it run.
- Retirement/capability checks: 8 passed. Chromium native exchange forms and phone-width profile editing/publication passed.
- Svelte: zero errors/warnings. Production build passed with synthetic configuration and a non-serving loopback database URL; no live database/provider was used.
- Full historical Core suite: 780 passed, 61 failed. The unchanged starting branch had 63 failures; remaining failures are existing historical/source-contract failures, not a green full-suite result. Focused changed-boundary checks passed.

 The old `npm test` suite already had 63 failures on unchanged Development `7e4b3259`; do not interpret that baseline as a passing release check. Retired-screen tests are removed deliberately, not silently skipped, while shared protection tests remain.

Before COMMIT, ROLLBACK restores the reset transaction. After COMMIT, recovery requires the operator's Neon snapshot. Restore to an isolated branch, inspect migrations/records, and reconcile any activity since the snapshot before a deliberate cutover. A restore also resurrects old sessions, verification records and erased content. Do not serve the restored copy without that review. Reverting the code does not restore deleted data.

## Future real-user account closure

Retain the P-305 support-assisted process until complete single-account closure is designed and tested. That operation must revoke credentials/sessions, unpublish profiles, remove owned private content and channel identifiers, unlink shared account references without erasing another owner's independent notes, and account for providers/backups. A one-time whole-database test reset is not that implementation.
