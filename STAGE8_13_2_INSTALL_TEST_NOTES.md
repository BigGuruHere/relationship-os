# Stage 8.13.2 - Living Understanding Production Workflow UI

## Purpose

Stage 8.13.2 makes the Living Understanding workflow clear in the normal product UI.

It distinguishes two states:

1. No authoritative Living Understanding exists yet - create and approve v1.
2. An authoritative revision already exists - review the impact of one new source against that persisted baseline.

The former development experiment route is retained internally, but `initial=1` now presents it as the guided first-v1 production workflow and is not dependent on the diagnostic experiment flag.

## Important database note

There is no new Prisma migration in Stage 8.13.2.

Do not reset the database for this release.

The Stage 8.13.0 canonical migration remains the current Living Understanding schema migration.

## Install

1. Back up the current development source folder.
2. Replace the project source with the contents of the Stage 8.13.2 complete-source ZIP.
3. Preserve your existing `.env` and credentials.
4. Do not copy an old `prisma/migrations` directory back over this package.
5. `package-lock.json` is unchanged from Stage 8.13.1.

## Validation commands

Run from the project root:

```powershell
npm run check:migration-integrity
npx prisma validate
npm run check:stage8.13.2
npm run check
```

Expected Stage 8.13.2 focused result:

```text
30 tests
30 pass
0 fail
```

The migration integrity command should report:

```text
PASS 81 production-deployed Prisma migrations are byte-for-byte unchanged.
```

## Manual first-v1 test

Use a person who has at least one authorised personal reflection or conversation excerpt and no authoritative Living Understanding.

1. Open the reflection.
2. Click `Review reflection and suggest knowledge`.
3. The reflection-review page should show:
   - `No Living Understanding exists yet`
   - `Create initial Living Understanding`
4. Click `Create initial Living Understanding`.
5. The next page should show the four-step workflow:
   - 1. Analyse source
   - 2. Generate topic understandings
   - 3. Review structure
   - 4. Approve v1
6. Authorise AI processing and click `Analyse source`.
7. Review the proposed areas and select the areas that should contribute to the Living Understanding.
8. Click `2. Generate selected topic understandings`.
9. Review the proposed topic understandings.
10. Either:
    - continue directly with `3. Review topic structure`, or
    - optionally expand `Add another source before creating v1` and incorporate one later source first.
11. After structural validation succeeds, review `Final proposed Living Understanding v1`.
12. Tick the explicit approval checkbox.
13. Click `Approve and create v1`.
14. You should return to the person's Living Understanding page with:
    - an authoritative v1,
    - the saved topic understandings,
    - revision history showing v1.

Nothing in the first-v1 workflow grants matching, sharing or disclosure permission.

## Manual v1 -> v2 test

After authoritative v1 exists:

1. Open a newer reflection for the same person.
2. Click `Review reflection and suggest knowledge`.
3. The page should now show `Review impact on Living Understanding` instead of the first-v1 action.
4. Open the impact review.
5. Confirm the page identifies the current authoritative baseline revision.
6. Analyse the new source.
7. Review affected topics, any genuinely new topics, and unchanged topics carried forward.
8. Approve the update.
9. Confirm the resulting revision is v2 and revision history still contains v1.

## Production behaviour

The `Create initial Living Understanding` workflow is now a product workflow and does not require `DATING_REVISION_EXPERIMENT=YES`.

The diagnostic experiment remains gated. The production first-v1 path is explicitly identified by `initial=1`, revalidates Dating custody server-side, and still requires the signed final adoption step before authoritative persistence.

If an authoritative Living Understanding is created while an initial-v1 page is open, reopening the first-v1 entry redirects to the longitudinal impact-review path rather than allowing a second initial baseline.

## Files intentionally changed

- `package.json`
- `src/lib/server/datingUnderstandingRevisionExperiment.ts`
- `src/routes/dating/people/[id]/understanding/+page.svelte`
- `src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts`
- `src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte`
- `tests/core/stage8-13-2-living-understanding-workflow-ui.test.mjs`
- `STAGE8_13_2_INSTALL_TEST_NOTES.md`

## Packaging verification performed

- Stage 8.13.2 focused/static regression suite: 30/30 passing.
- Migration integrity: 81 production migrations unchanged.
- `package-lock.json`: byte-for-byte unchanged from Stage 8.13.1.
- No new Prisma migration added.

The packaging environment does not contain installed project dependencies, so run `npx prisma validate` and `npm run check` locally before committing the release.
