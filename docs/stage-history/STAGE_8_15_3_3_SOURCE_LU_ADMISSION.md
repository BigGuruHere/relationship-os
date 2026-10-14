# Stage 8.15.3.3 - Source admission to Living Understanding

## Delivery scope

Core Interaction now has a durable `luAdmission` state. New Business contact notes default to `STORED_ONLY`; the save form offers an opt-in to `ELIGIBLE`. These states govern whether a source may enter the existing longitudinal LU impact-review/approval path, not whether it can be stored. The same gate is checked again when an approval token is used. Source custody continues to be scoped to user, ContextSpace and contact.

Legacy interactions default to `ELIGIBLE` so established Dorian/reflection workflows are not unexpectedly switched off. This is a compatibility default, **not retrospective consent**. Historical CRM notes may need an explicit backfill policy before any bulk LU ingestion.

`WITHDRAWN` is reserved in the database for later controlled withdrawal workflow and is not offered as a toggle. Withdrawal after authoritative LU inclusion requires impact assessment, affected-claim reconciliation and an auditable new revision.

This release does **not** auto-run LU generation when a note is opted in. It makes the source admissible to the existing review pipeline. It does not change matching eligibility, disclosure, public profiles, contact ownership, or the evidence-visibility issue reported for corrected notes.

## Migration

`20261014120000_stage8_15_3_3_source_lu_admission` adds a constrained text column to Interaction. No existing migrations were edited. On development only run `npx prisma migrate dev`. On Railway your existing `start:with-migrations` uses `prisma migrate deploy`. Do not run `migrate dev` against production.

## Verification commands

```powershell
# Validate and apply the forward-only migration against the development database.
npx prisma validate
npx prisma migrate dev
npx prisma generate

# Run the focused contract regression test.
npm run check:stage8.15.3.3

# Run framework and build checks.
npm run check
npm run build
```

If Prisma proposes an unrelated migration, stop and inspect the SQL; do not approve a database reset.

## Manual UI acceptance tests

1. **CRM-only default:** Business > Contacts > test contact > Add note. Leave LU checkbox unchecked, save. Note must be visible in CRM. The stored `Interaction.luAdmission` should be `STORED_ONLY`.
2. **Opted-in note:** Add another note and tick *Use this note for Living Understanding review*. Verify `ELIGIBLE` in the development database. This does not mean it has already been analysed or approved.
3. **Existing Dorian path:** Complete a permitted development Dorian call. Confirm its post-call LU proposal behaviour is unchanged.
4. **Denied analysis:** Using an authorised development test harness, attempt LU impact review for the `STORED_ONLY` note. It must reject the source.
5. **Approval recheck:** Ensure a source that is no longer eligible cannot be approved using an earlier review token. This requires a database integration test/harness before production rollout.
6. **Isolation:** Verify no source can be read or approved from another ContextSpace or another user's account.

## Remaining limitations / follow-up

- No user-facing switch for an already saved note; admission is selected when creating it.
- No source-level defaults-management screen for Dorian/reflections yet.
- No safe withdrawal/retraction workflow for information already approved into authoritative LU.
- CRM opt-in does not create an automatic proposal, and no separate LU engine is introduced.
- Corrected-note evidence display still needs the proposed lineage UX fix.
- Atomic enforcement inside LU persistence and real database integration tests remain required before treating policy enforcement as complete.
