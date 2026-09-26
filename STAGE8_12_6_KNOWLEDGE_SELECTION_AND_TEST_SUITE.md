# Stage 8.12.6 - Knowledge selection and regression-suite correction

## What changed

- The extraction prompt distinguishes one-off events from current living understanding and explicitly preserves relationship uncertainty when the same reflection also expresses a wish for a relationship.
- The deterministic review selector removes near-verbatim duplicate suggestions **within the same knowledge category**, favours supported uncertainty/constraints and deprioritises isolated historical attendance facts. It does not claim to infer importance semantically or guarantee model coverage.
- Up to 32 supported candidates can now be returned and reviewed in groups of 12. The first 12 are a balanced initial selection; later pages contain other selected candidates. All pages remain in the same review form, so saving includes the decisions across pages. This is a candidate-review convenience, not a replacement for the original reflection or a guarantee that all source facts were extracted.
- The original Stage 8.6 ContextSpace regression tests now reflect the 50-model / 127-edge schema and verify the *different* protections introduced by Stage 8.12.1. The 46 legacy models use sentinel defaults; the four Relating/Touchpoint models instead **require explicit contextSpaceId**. Older generic triggers cover 112 edges; 15 newer edges have scoped composite foreign keys or specialised SQL custody validation. The tests list every new boundary by its actual model and field.
- `npm test` now discovers all `tests/core/*.test.ts` **and** `tests/core/*.test.mjs` regression tests, including all stages so far. `npm run test:db` runs the historical opt-in development PostgreSQL scripts; `npm run test:all` requires this opt-in and then runs check/build. `npm run check:stage8.12.6` runs new focused pure regression tests.

## Important limitations

- The newly expanded source-level tests do not substitute for executing a live PostgreSQL custody rejection test. Use the opt-in development DB suite on an isolated **development** database, never production.
- AI extraction can still miss a key nuance, return fewer than 12 useful results or produce overly broad proposals. The UI continues to require review, and operator confirmation is **not** participant confirmation or permission to disclose information.
- The old batch save mechanism persists reviewed items sequentially; a mid-save failure may leave a subset saved. Re-opening the history and retrying is idempotent for previously saved same-source/type/wording. A fully transactional batch-save redesign is separate work.
- Current candidate storage is an in-form selection, not a permanent draft queue. A page reload before saving discards unsaved suggestions; the original private reflection remains available for another extraction.
- Existing dependency and Catalina-compatible lockfile have not been changed. No schema or migration change.

## Test evidence from packaging environment

- The `.test.mjs` suites run under Node 22 with experimental type stripping, including earlier AI extraction and the new custody/selection checks.
- The complete TypeScript test suite, Prisma generation, application compilation, live provider extraction and development-database tests were not run in the packaging environment because the project dependencies and development DB were unavailable there. Run the commands in the installation guide on your Mac.
