# Stage 8.12.11 - Suggested topic placement and operator review

## What changes in the browser

After saving reviewed reflection suggestions, Living Understanding opens the most recently updated active statement that has no topic assignment (if one exists). For any selected current statement, a new **Suggested topic placements** panel proposes up to three existing or new topics. It shows the complete statement, an explanation, its existing assignments, and a link to its original private reflection when linked. The operator can explicitly assign an existing topic, edit and create a new topic then assign, or expand the full manual topic selector. Multi-topic assignment is retained. Suggestions never make a database change by themselves.

## Important implementation distinction

These initial placement hints are an explainable, deterministic local rule set based on statement wording and existing topic names. They do **not** invoke an additional AI model, perform comprehensive semantic interpretation, read another participant's private records, or assign topics automatically. Topic labels remain encrypted at rest. The existing operator-confirmation and subject-confirmation distinction is unchanged. Suggestions are computed from authorised, already-loaded, active claims and same-person topics, with no new private-content diagnostics.

## Files changed

- `src/lib/server/datingTopicPlacement.ts`: pure placement policy with specific life-area hints and existing-topic matching.
- `src/routes/dating/people/[id]/understanding/+page.server.ts`: scoped suggestion assembly and explicit create-and-assign endpoint with prior active-claim validation.
- `src/routes/dating/people/[id]/understanding/+page.svelte`: reviewed statement, source link, suggested placements and an optional manual selector.
- `src/lib/server/datingLivingUnderstanding.ts`: includes the first linked source-reflection ID on the already-authorised active knowledge view.
- `tests/core/stage8-12-11-topic-placement.test.mjs`: executable deterministic cases plus source-inspection route guards.
- `package.json`: `check:stage8.12.11` script.

## Verification

- `npm run check:stage8.12.11`: 4 passed.
- `node --experimental-strip-types --test tests/core/*.test.mjs`: 93 passed, 0 failed in the packaging environment (Node 22.16.0).
- No schema changes and no migrations.
- Full `npm test` (includes TypeScript tests), `npm run check`, `npm run build`, real DB tests and browser tests were **not run** here because dependencies are not installed. Run them on a Mac or another supported development environment against the intended development database.

## Security and UX constraints

- The server checks user, Dating ContextSpace, and contact custody before decrypting records.
- Topic suggestions do not confer consent to store additional material or disclose information.
- The new topic/assignment action verifies the active claim before creating a topic. It reuses the existing scoped topic creation and scoped assignment services. Those are separate transactions, so a rare concurrent deletion between these operations can leave an empty topic; retry/removal should be managed in the operator UI. A future transactional consolidation can eliminate that edge case.
- The existing source link routes through the current authenticated, scoped reflection-read service.
- All changes are additive; no automatic bulk topic organisation or migration of older claims occurs.
