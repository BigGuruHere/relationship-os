# Relish Stage 8.13.1 - Authoritative Longitudinal Production Engine

## Purpose

Stage 8.13.1 crosses the production seam identified in the Stage 8.13 bootstrap:

`authoritative revision + one new authorised source -> affected topic versions only -> next authoritative revision`

This release is code-only. It adds no Prisma migration and relies on the canonical Stage 8.13.0 persistence foundation.

## What changed

- Added `src/lib/server/datingLongitudinalLivingUnderstanding.ts`.
  - Loads the current baseline from persisted `LivingUnderstandingRevisionTopic` membership.
  - Uses stable `topicIdentityId` and `topicVersionId` values rather than legacy `UnderstandingTopic` inventory.
  - Requires every authoritative topic to be explicitly classified for the new source.
  - Requires target-speaker evidence for every non-`UNCHANGED` effect.
  - Generates revised prose only for materially changed topics.
  - `REINFORCED` topics keep their prose but receive a new immutable topic version so new evidence does not retroactively alter v1 provenance.
  - Signs the complete reviewed proposal into a short-lived, custody-scoped approval token.
  - Delegates stale-baseline and idempotency enforcement to the Stage 8.13.0 transactional persistence layer.
- Added the production route:
  - `/dating/people/[id]/understanding/impact-review`
  - Shows authoritative baseline, new source, affected topics, new topics, unchanged carried-forward topics, and proposed next revision.
  - Requires explicit AI-processing consent and a separate explicit approval before persistence.
- Updated the normal reflection workflow.
  - If an authoritative Living Understanding already exists, the primary action is now **Review impact on Living Understanding**.
  - The old revision experiment remains available only for creating the first authoritative baseline in development.
- Production review checkpoints are bound to:
  - `sourceInteractionId`
  - `baselineRevisionId`
  - `baselineRevisionNumber`
- Added focused Stage 8.13.1 static tests and an opt-in DB integration script.

## Important persistence behaviour

For a baseline such as:

- A -> A1
- B -> B1
- C -> C1

and new evidence affecting only B, approval creates:

- A -> A1
- B -> B2
- C -> C1

A1 and C1 are not regenerated. The new source is revision provenance for v2 and topic-version provenance only for B2.

## Install

Replace the source tree with the Stage 8.13.1 package using your normal clean replacement workflow. Do not copy old deleted migration folders back into `prisma/migrations`.

No new `npm install` is required for Stage 8.13.1. `package-lock.json` is unchanged.

## Required checks

Run from the project root:

```powershell
npm run check:migration-integrity
npx prisma migrate status
npx prisma validate
npm run check:stage8.13.1
npm run check
```

Expected migration result: Stage 8.13.1 adds no migration. The latest Living Understanding migration remains:

`20261002010000_stage8_13_0_longitudinal_living_understanding_foundation`

## Opt-in development DB integration test

Use only against the disposable development database.

Required environment variables:

- `ALLOW_DATING_DEV_DB_TEST=YES`
- `DATABASE_URL`
- `SECRET_MASTER_KEY`
- `DATING_TEST_USER_ID`
- `DATING_TEST_CONTEXT_SPACE_ID`

Run:

```powershell
npm run check:stage8.13.1:db
```

The DB test verifies:

1. authoritative v1 exists with three persisted topic identities
2. signed production approval creates v2
3. only the affected topic receives a new topic version
4. two unchanged topics keep their exact v1 `topicVersionId` values
5. new-source provenance attaches to the changed version only
6. exact repeat approval is idempotent
7. a proposal based on stale v1 fails after v2 exists
8. an approval token cannot cross person custody
9. disposable fixture cleanup runs

## Manual Jack acceptance test

After recreating Jack and an authoritative v1:

1. Add/select the new relationship reflection.
2. Open **Review impact on Living Understanding**.
3. Confirm the page says baseline `Authoritative v1`.
4. Authorise AI impact analysis.
5. Confirm existing persisted topic identities such as Relationship readiness and Desired relationship dynamics are recognised rather than recreated.
6. Confirm unrelated topics appear under **Unchanged topics carried forward**.
7. Approve the proposed update.
8. Confirm the main Living Understanding page now shows authoritative v2.
9. Verify unchanged topics retain their old topic-version IDs in the DB integration/debug view.
10. Verify the new source is not attached to unrelated topic versions.

## Checks completed in packaging environment

Passed:

- Stage 8.13.1 focused/core regression suite: 25/25
- migration integrity check: 81 production-deployed migrations unchanged
- `package-lock.json` hash unchanged from Stage 8.13.0

Not runnable in the packaging environment because dependencies were not installed and `npm ci` could not complete there:

- `npx prisma validate`
- `npm run check` / Svelte type checking
- opt-in real DB integration test

Run those locally before promoting the release.

## Production safety

- Do not reset production.
- No new migration is introduced by this release.
- No matching, disclosure or sharing permission is created by Living Understanding approval.
- The selected reflection/conversation source is re-authorised against owner, Dating ContextSpace and person custody before analysis and approval.
