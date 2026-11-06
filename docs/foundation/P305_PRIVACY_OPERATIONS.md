# P-305 privacy and operations readiness

Branch `feature/p305-privacy-operations` starts from development `d6950e2` (P-304). This stage implements foundation vault operations, person archiving and a recovery rehearsal. It requires no Prisma migration. Live deployment, support case handling, and cohort activation remain separate approvals.

## What the user and support can do

- **Archive a person** from their My People detail page. The existing owner-scoped archive hides the person and the associated history in My People. It retains the underlying records. An archived capture does not block another voluntary submission or undo an already downloaded vCard.
- **Request access, correction, deletion or account closure** through the existing privacy mailbox, `admin@doriankreed.com`. Support verifies identity and the request scope before exporting, changing or releasing anything. QR receipts, matching names and email drafts are not identity proof.
- **Ask support to suspend foundation access.** Suspension advances the account epoch and locks its vault under the same locks used by owner and capture writers. Outstanding foundation draft authority and transcript polling fail closed. Provider input already sent cannot be recalled.
- **Erase a whole foundation vault** after approved scope and retention review. Erasure requires prior committed suspension, then removes all foundation content in dependency order in one transaction. A failure rolls back the entire erase, with suspension still in effect. The empty locked vault and suspended enrollment are retained to prevent routing back to the legacy writer. A completed erase can be retried safely.

The service operates on one vault. It does not remove the shared User, Profile, legacy Contacts and Brokerage, Dorian conversations or provider records. Suspension is not a global login block and does not unpublish a card. For full closure, review those stores and explicitly approve account/session, public profile, legacy and provider actions. Account removal must be designed against actual dependencies before removing the routing tombstone or deleting User. For a request about one note, person or shared source, review the evidence and derived statements and use a separately approved targeted correction or erasure procedure. Do not erase an entire vault for a partial request, or delete another participant's private notes automatically.

## Support case workflow

1. Record an opaque case reference, identity verification method and approved scope in the restricted support case record. Verify the user's request through the established account or recovery channel. A request about a person mentioned in someone else's records requires separate review; never export that other participant's vault wholesale.
2. Inventory relevant stores before claiming completeness. Check the foundation vault, account and public profiles, any pre-handoff legacy People records, Brokerage custody and links, Dorian conversations, consent records, SMS/provider stores and applicable backups. Document which contain relevant information and who owns the remaining actions. Protect third-party data, legal holds, authentication secrets and credentials.
3. Use the review artifact only to prepare an approved disclosure. It includes readable owned foundation subjects, contact fields, notes and source versions, statement history, context and evidence relationships. It may include other people's details and past or disabled versions. It omits credentials and internal MACs and is not a complete account export or ready-to-send attachment. Review and redact before delivery via an approved protected channel. Keep only as long as required for the case.
4. For an approved vault erase, suspend first, confirm the unavailable state and inspect counts. If needed, obtain an authorised review copy before erasure. Confirm holds and scope, then erase and inspect again. Document counts and outcomes, and verify any legacy or external follow-up separately. Never copy payloads, emails or transcripts into a support ticket or log.
5. Confirm the real retention settings and evidence before closing the case. Use the existing privacy policy's access, correction, deletion and backup language as the product baseline. Establish actual backup cycles, provider and SMS retention, and any exception before stating a deadline or claiming irreversible erasure. A backup or provider may retain copies after removal from the live vault. The in-process note audio timer is best effort and the provider arrangements require separate verification.

## Offline operator command

The shell and restricted database credentials are the operator boundary. There is no web endpoint for these operations. Use a protected operator session and secret file outside the repository. Use the direct endpoint for the approved database. Keep DATABASE_URL and SECRET_MASTER_KEY in the existing secret mechanism, and set P305_EXPECTED_TARGET to the exact host (including explicit port if present) and database path copied independently from the selected branch. The command validates that target before connecting. Its deliberately limited URL options reject alternative hosts/schemas. Start on a disposable DEV-derived branch with a synthetic enrolled account. Never paste secrets or review content into chat.

```sh
# Replace the example values with the verified case UUID, account ID and exact DEV target.
export P305_EXPECTED_TARGET='ep-example.neon.tech/neondb'
p305_case='00000000-0000-4000-8000-000000000001'
p305_account='synthetic-account'

# Read only counts and lifecycle state before proceeding.
node --env-file=/secure/relish-dev.env --import tsx scripts/foundation-privacy.ts inspect "$p305_case" "$p305_account"

# Write a new 0600 review file in a protected directory outside the checkout.
node --env-file=/secure/relish-dev.env --import tsx scripts/foundation-privacy.ts review "$p305_case" "$p305_account" /secure/case/review.json

# Commit suspension only for this approved case and exact account.
P305_CONFIRM="suspend:$p305_account:$p305_case" node --env-file=/secure/relish-dev.env --import tsx scripts/foundation-privacy.ts suspend "$p305_case" "$p305_account"

# After verifying suspension, holds and scope, erase the approved foundation vault content.
P305_CONFIRM="erase:$p305_account:$p305_case" node --env-file=/secure/relish-dev.env --import tsx scripts/foundation-privacy.ts erase "$p305_case" "$p305_account"
```

The review fails without a partial report above 500 rows per foundation collection or a cumulative 12 MiB encrypted-content allowance. Escalate an oversized or invalid/corrupted case for a reviewed manual export. The command refuses to overwrite an existing review file. It reports safe case and failure references and aggregate counts. Capture continues returning its existing support reference. Foundation note save failures now provide a reference that can be matched to an allowlisted stage and database error category. Voice provider diagnostics continue using their existing correlation ID. The P-305 logs contain no submitted text, credentials, raw SQL errors or database parameters. Preserve the existing rule against enabling Prisma query logging on participant data.

## Restore and release checks

Local validation passed 22 checks across privacy, notes and the foundation boundary. The standalone command was exercised against synthetic accounts, including wrong targets, missing confirmation and refusing to overwrite an export.

The automated restore test takes a physical snapshot of a disposable database containing encrypted corrected evidence and two owners. It erases one vault, restores the snapshot into a separate database, verifies the encrypted content and suspension, and reapplies erasure to the restored copy. It verifies that the other account remains accessible. This is evidence of the application recovery and replay procedure, not an attestation of hosted Neon recovery.

For hosted DEV acceptance:

1. Use the previously exercised DEV snapshot process. Use the multi-step restore into a **new isolated branch**. Keep Railway DEV/PROD connections on their current branches. Record the DEV source branch, snapshot time, restored branch, expected migration state, prior counts and approved retention window in the release record.
2. Compare the snapshot manifest and restored aggregate counts with [the read-only inventory](../../scripts/foundation/inventory-readonly.sql). Check the foundation tables and fixed status counts, without displaying any record contents.

   ```sql
   -- Run on the isolated restored branch. Report only table and state counts.
   BEGIN TRANSACTION READ ONLY;
   SELECT count(*) AS foundation_tables FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name LIKE 'Foundation%';
   SELECT state, count(*) FROM "FoundationEnrollment" GROUP BY state ORDER BY state;
   SELECT count(*) AS vaults FROM "FoundationVault";
   ROLLBACK;
   ```

3. Using an authorised synthetic enrolled account on an isolated copy, check the review result, suspend and erase. Restore the pre-erase copy separately. Verify the synthetic graph, then replay suspension and erase in case order before serving any requests from the restored copy. Track all intervening deletions and withdrawals in the restricted case record. A restore may reintroduce erased content, stale sessions and grants. Reconcile those, and reverify access and side effects, before any future approved cutover.
4. Confirm the restored copy and protected review files have the approved disposal schedule. Record the smoke results and deployed SHA for DEV. Maintain a separate rollback record. Never downgrade a suspended or erased foundation owner into legacy People storage as a recovery step.

P-306 release acceptance remains gated on the hosted restore/replay, full closure and third-party retention handling, live DEV/mobile checks, and an explicit cohort decision. No live database or provider data was accessed during this implementation.
