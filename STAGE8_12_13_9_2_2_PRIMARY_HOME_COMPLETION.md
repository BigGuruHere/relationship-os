# Stage 8.12.13.9.2.2 - Primary Home Completion

## Purpose

This is the final narrow closure patch for the read-only Living Understanding v1 architecture validation sequence.

The Stage 9.2.1 live run showed that semantic-overlap groups could correctly identify one shared meaning and one shared destination, while an equivalent cross-reference meaning unit was still left with zero primary owners. That made an otherwise coherent restructuring proposal fail the trust invariant that every durable meaning unit must have exactly one primary semantic home.

Stage 9.2.2 closes that implementation gap without changing the knowledge architecture.

## Rule

When a meaning unit has no primary owner, the server may resolve the missing owner from a declared semantic-overlap group only when all of the following are true:

- the overlap group already has exactly one non-empty primary semantic home
- the destination proposed topic already represents the missing meaning unit
- that topic has a semantic check for the meaning unit
- the mapping is `SAME_MEANING`
- the primary-home fit is `PURPOSE_CONTEXT_FIT`

If any of those conditions is missing, the validator does not invent a home and the proposal remains invalid.

More than one primary owner is never repaired automatically.

## Compatibility

The earlier Stage 9.1, 9.2 and 9.2.1 contracts retain their prior behavior. Automatic overlap-group primary-home completion applies only to validation contract `8.12.13.9.2.2`.

The UI marks a server-resolved ownership assignment as `server-resolved from overlap group` so the resolution remains visible during the experiment.

## Persistence

This remains a read-only experiment. No stored topic, understanding, statement, permission, sharing rule, historical version or database schema is changed by this stage.
