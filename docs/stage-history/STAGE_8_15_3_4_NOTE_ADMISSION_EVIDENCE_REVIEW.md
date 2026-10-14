# Stage 8.15.3.4 - Saved-note LU admission and evidence lineage

## Objective
Keep CRM notes as CRM notes unless explicitly opted into Living Understanding, permit later opt-in/opt-out safely, and show existing claim evidence across corrected-note history.

## Changes
- Current contact-note detail includes LU admission selection. A previously stored-only or withdrawn note can become eligible. An eligible note not yet used in authoritative LU can be withdrawn from further LU use.
- A correction chain uses one common LU admission decision, applied transactionally with user, ContextSpace and Contact scoping.
- When a note is corrected, its replacement inherits the previous LU admission setting instead of defaulting to eligible.
- If any note revision is recorded in an authoritative Living Understanding revision source, turning LU admission off is **blocked** and the user is told that a reviewed LU reassessment is required. No misleading successful withdrawal is recorded.
- Knowledge claims are displayed across current and previous note revisions with the original version reference, status and active evidence counts. Original evidence is not silently moved.
- No new SQL migrations. Reuses Interaction.luAdmission from 8.15.3.3.

## Important limits
- This is safe opt-in/withdrawal **before authoritative LU incorporation**, not full historical LU withdrawal. A later reviewed reassessment flow must construct and approve revised LU topics, handle operational promotions, and audibly preserve the old revision and provenance.
- The change does not automatically initiate LU proposal generation when opting in.
- An old eligible note previously used in LU remains visible as eligible; the UI blocks disabling it until a reviewed reassessment exists.
- Knowledge evidence and LU admission are **different mechanisms**. Toggling LU admission does not erase knowledge claims, embeddings or operational Want/Offer/Objective records.
- Source-level tests are not live database or browser tests. Run npm run check and full integration testing locally before deploying.

## Development commands
```powershell
# Confirm the latest source and development database are selected.
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm run check:stage8.15.3.4
npm run check:stage8.15.3.3
npm run check:stage8.15.3.2
npm run check
npm run build
```

## UI acceptance tests
1. **Stored only after save:** Business > Contacts > test contact > Add Note. Leave LU opt-in unchecked. Save, open the note. Check that it says CRM only. Edit its content and check the latest revision still says CRM only.
2. **Later opt-in:** On a stored-only note, choose Yes - eligible for review and update. Reopen and verify eligible status. No proposal should appear automatically.
3. **Withdrawal before approval:** On a note that is eligible but has never contributed to authoritative LU, select No - CRM only and update. Verify it says withdrawn from future LU review. Re-enable and verify it becomes eligible again.
4. **Evidence after correction:** Capture knowledge from a note, then edit the note. Open the current version. In Knowledge evidence across note versions, confirm the previous version's claim still appears and shows its superseded status. The new current note does not claim the old evidence as its own.
5. **Authoritative safety:** Use an existing development source known to have been included in an approved LU revision. Attempt to switch LU off. Verify the control is disabled and the explanation is present. If calling the form action directly, verify the server rejects it without changing admission.
6. **Custody:** Verify a different user/ContextSpace cannot view evidence history or modify admission for the note.
7. **No implicit sharing:** Check that changing LU eligibility does not make note contents publicly visible, match-eligible or shareable.

## Verification completed in packaging environment
- Source-contract regression tests: 9 passed across 8.15.3.2, 8.15.3.3 and 8.15.3.4.
- Prisma validation, Svelte check, build, and live database/browser tests: not run because node_modules and development database credentials were unavailable.
