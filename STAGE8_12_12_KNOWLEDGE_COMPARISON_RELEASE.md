# Stage 8.12.12 - Operator-reviewed knowledge comparison

## What is implemented

In Dating > People > Living Understanding, select a current statement in **Compare new knowledge with earlier understanding**. The page offers only other active statements belonging to the same person and sharing an assigned topic. Read both full statements and follow source-reflection links where available. An operator can record that the new statement is independent, supporting, refining, potentially conflicting, or superseding. The classification, optional reason and copies of both statements are retained as encrypted comparison-history events. Nothing is shared with another person or application context.

Only an explicitly acknowledged **supersedes** decision retires the earlier KnowledgeClaim from the current active view. It remains in the database with its encrypted text, source evidence and historical topic links. All other classifications leave both claims active. Source reflections and old review events remain unchanged. An identical repeated comparison is idempotent. Candidate selection uses shared topics, not semantic analysis; the operator must decide what the relationship means.

## Files changed

- `src/lib/server/datingKnowledgeComparisonPolicy.ts`: pure validation and shared-topic selection.
- `src/lib/server/datingKnowledgeComparison.ts`: custody-scoped, transactionally recorded encrypted comparison events; explicit, acknowledged supersession and history reads.
- `src/routes/dating/people/[id]/understanding/+page.server.ts`: comparison candidates, history and save action.
- `src/routes/dating/people/[id]/understanding/+page.svelte`: side-by-side review and explicit retirement checkbox.
- `tests/core/stage8-12-12-knowledge-comparison.test.mjs`: executable pure tests and source-boundary assertions.
- `scripts/check-stage8-12-12-knowledge-comparison-db.ts`: gated development-database fixture testing same-person scope, idempotence, supersession and retained evidence.
- `scripts/run-stage-db-tests.mjs`, `package.json`: register integration and stage checks.

## Verification and limits

- 97 `.test.mjs` tests passed in the packaging environment; standalone policy TypeScript check passed using the global `tsc` with ES2022 target.
- ZIP integrity verified after packaging.
- No database migration, lockfile change, environment changes or external AI calls in this stage.
- Full `npm test` including TypeScript tests, `npm run check`, `npm run build`, live development DB integration and browser acceptance could not be run here because the project's installed dependencies and DB credentials are unavailable. Run them on your own authorised development setup before deployment.
- The UI currently requires two active statements to have a common topic. It does not automatically identify semantic contradictions, suggest which comparison classification is correct, or infer participant consent. An additional conversation-transcript import stage is planned, not delivered here.
