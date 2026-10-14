# Stage 8.15.3.2 - Current Notes and Revision History

## Purpose
A corrected contact note is still the same user-facing note. Show only its current version in Recent notes, while retaining historical revisions as encrypted source evidence.

## Changes
- Existing `correction-of` references now form one visible revision chain, without a new SQL migration.
- Contact Recent notes shows the latest content once and marks it **Edited**.
- Opening an older revision URL redirects to the current revision (within the same owner, ContextSpace and contact).
- Current note details expose an optional expandable revision history, including decrypted historical content available only to the authorised owner.
- Both correction entrypoints use the same scoped Core service and refuse editing a stale version.
- Active KnowledgeEvidence citing a superseded note revision is marked `SUPERSEDED`. A claim is marked `SUPERSEDED` only when it has no other active evidence.
- Existing authoritative Living Understanding revisions remain immutable; automated LU impact review is **not** implemented by this stage.
- Existing `Interaction` rows are preserved, including exact original evidence. No historical migrations changed.

## Development
```powershell
# Check the existing schema and development migration state.
npx prisma validate
npx prisma migrate dev
npx prisma generate

# Run the new and previous stage checks.
npm run check:stage8.15.3.2
npm run check:stage8.15.3
npm run check:stage8.15.3.1
npm run check:stage8.15.2
npm run check
npm run build
```
No new database migration is supplied in this stage.

## Manual UI tests

### Test 1 - One note after correction
- [ ] Business > Contacts > open a test contact > Add voice/note.
- [ ] Save a note, then use **Edit note** and correct its text.
- [ ] Return to the contact's **Recent notes**.
- [ ] Confirm only the latest text appears, in one note entry labelled **Edited**.
- [ ] Open that entry and confirm the corrected text is displayed.

### Test 2 - Multiple edits and version history
- [ ] Edit the same note again.
- [ ] Confirm the contact list still shows one entry.
- [ ] Open **View edit history** and expand versions 1, 2 and 3.
- [ ] Confirm each version contains the text saved at that point.

### Test 3 - Old URLs and stale edit protection
- [ ] Save a URL pointing to the first revision before editing it.
- [ ] After correcting the note, open that saved URL.
- [ ] Confirm it redirects to the current note.
- [ ] Attempt to submit an editing form opened before the correction; it should reject a stale revision rather than overwrite the latest.

### Test 4 - Captured knowledge
- [ ] Capture a knowledge claim from a test note.
- [ ] Correct the note so that claim is no longer supported.
- [ ] Confirm original evidence remains in history.
- [ ] Confirm the former evidence/claim is superseded where no other active support exists (may require inspecting the knowledge view or development database).
- [ ] Confirm the corrected note is not automatically treated as an authoritative LU revision.

### Test 5 - Context custody
- [ ] Confirm another user/ContextSpace cannot view current or historical note text or submit a correction.

## Known limitations and follow-up
- The revision chain uses the existing `externalRef` convention, and grouping currently reads all interaction IDs for a contact before listing the last 50 current notes. Add pagination/indexed revision modelling if volume increases.
- Creation of a correction and superseding its evidence are not yet one database transaction. A failure between operations may require repair. A later implementation should make that transition atomic.
- Approved LU revisions and downstream promoted Want/Offer/Objective records are not automatically re-evaluated. This requires a governed impact/review workflow before automated matching is enabled.
- The older interaction summary remains separately editable and is not versioned here.
- Source-level checks are not equivalent to real database or browser tests.

## Verification performed here
- New 8.15.3.2 tests: 3 passed.
- Contact-note and perspective source regressions: 7 passed.
- Prisma-alignment and Review Inbox source regressions: 3 passed.
- Capability policy tests: 3 passed with `--experimental-strip-types`.
- `npm ci`, Prisma validation, real migrations, Svelte checking and browser acceptance testing were **not** run in this environment.
