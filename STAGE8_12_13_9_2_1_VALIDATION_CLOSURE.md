# Stage 8.12.13.9.2.1 - Validation Closure

This stage closes the final enforcement gaps found by the live Stage 9.2 structural review. It does not add a new Living Understanding feature and does not persist any experimental result.

## Closure rules

1. Semantic-identity completion is server-derived. The model completion boolean is compatibility/debug metadata only. The server relies on validated meaning-unit coverage, overlap-group consistency, one-primary-home enforcement and its pairwise lexical duplicate backstop.
2. A source topic audited with `MULTIPLE_INDEPENDENT_CONCEPTS` must actually distribute those meaning units across at least two distinct primary semantic homes. A KEEP or RENAME that leaves them bundled is rejected.
3. Primary ownership must follow the meaning unit's stated purpose/context. Stage 9.2.1 retains the explicit `PURPOSE_CONTEXT_FIT` contract and adds a conservative server-side lexical backstop between strong purpose signals and the proposed topic label/reason.

## Non-goals

- no database migration
- no authoritative Living Understanding persistence
- no new operational-knowledge model
- no change to custody, consent, sharing or source authorization
- no attempt to make topic naming stylistically perfect

If the difficult live acceptance case now returns with no structural validation warnings and no audit/operation contradiction, this stage is intended to close the experimental core-validation sequence before persisted Living Understanding v1.
