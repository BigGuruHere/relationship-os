# Stage 8.12.10 - Evidence-aware extraction accuracy

## Scope

This is a targeted deterministic selection and diagnostic release. It does not modify the database schema, change consent rules, or update dependencies. The source reflection remains private and source-preserving. The Stage 8.12.9 workflow is unchanged.

- Added a permanent, wholly fictional regression fixture covering loneliness, friendships, interests, small-group preferences, business ambition versus isolation, romantic openness versus uncertain readiness, individuality, and the lower priority of historical trivia.
- Protected wording differences involving uncertainty, negation, temporal scope and readiness from lexical near-duplicate removal. The gate still consolidates near-verbatim unqualified repetitions, but deliberately errs on the side of leaving ambiguous material for human review.
- Added count-only rejection reason codes: malformed item, invalid kind, invalid statement, invalid/missing source passage, exact and near duplicates, and candidates deferred by a limited review window. The existing aggregate counts remain for compatibility. The new codes appear only in the development diagnostics panel behind its existing non-production opt-in.

## Important accuracy boundary

A verbatim evidence passage is a prerequisite, **not proof that a proposed statement is supported by that passage**. For example, a model could present the statement "does not like tennis" alongside the passage "I like tennis". This deterministic fixture is designed to expose that limitation rather than imply semantic entailment validation. Likewise, these counts cannot identify ideas the model never proposed. Human review remains essential. A separate live-model evaluation needs an explicitly authorised development run against a fictional or consented fixture, not real personal reflections in ordinary logs.

## Verification

In the project directory on a supported Node 22 build:

```bash
npm ci
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run check:stage8.12.10
npm test
npm run check
npm run build
```

`migrate status` should be inspected against the designated development database. **Do not apply migrations or run database tests against production.** No new migration was introduced for Stage 8.12.10. Real database integration tests require their existing explicit development-only environment gate and fixture IDs. `npm test` exercises deterministic code but is not a substitute for actual DB, browser or live-AI evaluation.

## Packaging-environment results (26 September 2026)

- ZIP input integrity checked successfully.
- All 89 `.test.mjs` test cases passed using the Node 22 built-in TypeScript strip-types loader, including the four new tests.
- `npm test` was attempted but did not reach the tests: `tsx` is not installed in this packaging environment (`ERR_MODULE_NOT_FOUND`). Dependencies have not been installed here; consequently, the complete `.test.ts` suite, `npm run check`, `npm run build`, browser acceptance and live development database tests remain unverified. This is not an application test failure.
- No environment files, database records, lockfile, migration or existing reflection workflow routes were intentionally modified beyond the diagnostics display.
