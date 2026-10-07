# Relish Stage 8.11.2 - Element-level Dating Review

Baseline: Stage 8.11.1 complete source, original Catalina-compatible dependency lockfile. No Prisma migration, no database reset, and no dependency upgrade.

## Scope

Each of the six existing review sections now requires an independent human decision: **Confirm as my account**, **Correct and confirm my account**, **Reject this element**, or **Leave unconfirmed for now**. Confirmation verifies only that the respondent accepts the account as their own. It never verifies the other person's feelings or consent. A correction requires an actual edit; a changed section cannot be confirmed as unchanged.

The approved private `dating_outcome_reviewed` AgentArtifact stores each decision, timestamp, respondent ID, source Interaction ID, and the accepted/corrected text in encrypted content. Rejected and deferred text is excluded from the approved reflection, but the original remains in the separate encrypted provisional proposal with its provenance. No element decisions or sensitive text are copied into plaintext audit JSON.

**A canonical Outcome is created only when the whole-Introduction Outcome has its own CONFIRMED/CORRECTED decision.** A review can be saved with that section rejected or deferred: no Outcome is created. The whole review's approval is therefore a review-completion event, not wholesale confirmation. The existing optimistic/transactional concurrent-approval guard is preserved.

No KnowledgeClaim promotion, outreach, notification, booking, cross-participant verification, or disclosure is triggered. Existing consent can only be narrowed during review. Legacy approved reviews remain readable with a clear note that they predate individual element confirmation.

This stage covers the six current *sections* of the existing extraction. Breaking a section into multiple individually sourced atomic claims, and mutual independent verification, remain future work.

## Mac installation

Merge the complete source package into your local project, preserving `.env` and local edits. Use the previously working Catalina-compatible `package-lock.json` provided in the ZIP. Do not run Stage 8.10.5's dependency upgrade script on Catalina.

```bash
npm ci
npx prisma generate
npx prisma migrate status
npm run check:stage8.11.2
npm run check:stage8.11.1
npm run check:stage8.10
npm run check:stage8.10.4:voice
npm run check
npm run build
```

If a database reset is offered, decline. This release has no new migration.

## Windows PowerShell database integration test

Confirm the `.env` points to **development**, then run:

```powershell
$env:DATING_TEST_USER_ID = '69335c81-f1b0-4383-96aa-99007d622516'
$env:DATING_TEST_CONTEXT_SPACE_ID = '32e74f61-4249-4768-b524-8c9a24bc3fd9'
$env:ALLOW_DATING_DEV_DB_TEST = 'YES'
npm run check:stage8.10.3:db
```

The existing real PostgreSQL integration test now also checks per-section corrected decisions, deferred whole Outcome (no Outcome creation), rejected other-person impression, and preserved private next step. It uses unique fixtures and cleans up only those records.

On macOS, the equivalent environment prefix is `export` instead of `$env:`.

## Browser acceptance

1. Start `npm run dev`, sign in, and open a new pending Dating reflection.
2. Inspect the original transcript alongside all six proposal sections.
3. Confirm one unchanged section; edit another and choose Correct and confirm; reject your proposed interpretation of the other person; defer your desire to continue.
4. Defer the whole-Introduction Outcome, select a private next step, and save the review. Reopen it and verify the independent decisions and corrected text. No new Outcome should appear.
5. Create another reflection and specifically confirm its whole-Introduction Outcome. Exactly one Outcome should be created. Verify it is attributed to one respondent only.
6. Verify rejection and deferral never expand disclosure permission, and that legacy approved reflections still load.

## Outstanding before a public pilot

Live browser microphone/transcription smoke testing; HTTP-level login/session tests; upload size/ownership review; production dependency vulnerability remediation on a supported build system. Stage 8.11.2 is appropriate for local development only until those checks are complete.
