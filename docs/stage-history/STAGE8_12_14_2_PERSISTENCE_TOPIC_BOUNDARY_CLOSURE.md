# Stage 8.12.14.2 - Persistence and Topic-Boundary Closure

This stage closes two issues found during the first authoritative Living Understanding save attempt and the subsequent live structural review.

## Persistence timeout

The Living Understanding adoption transaction now has a local 15 second timeout. This is intentionally scoped to this write path rather than changing Prisma transaction defaults globally. Source custody re-authorization remains inside the same atomic transaction.

## Coherent topic boundaries

The structural review now distinguishes between:

- `MULTIPLE_INDEPENDENT_CONCEPTS`: meanings with materially different semantic purposes that require separate primary semantic homes.
- `COHERENT_MULTI_DIMENSIONAL`: several distinguishable dimensions that share one durable semantic purpose and can remain together as one rich Living Understanding topic.

This prevents over-fragmenting coherent topics such as desired relationship dynamics while preserving the rule that genuinely independent areas, such as business priority and working alone, must be separated.

The existing primary-home, temporal ownership, semantic-identity, fidelity, coverage and provenance rules remain unchanged.

## Database

No database schema change or migration is included in this stage.
