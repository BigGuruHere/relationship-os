# Stage 8.12.13.9.1 - Temporal and Semantic Ownership Validation

This is the final targeted core-hardening step before the Living Understanding v1 freeze decision.

## Trust invariants added

- Every durable meaning unit in a restructuring review must be inventoried from an exact excerpt of the prior current understanding.
- Every meaning unit must have exactly one primary semantic home. Cross-topic references may exist, but they cannot create multiple independent owners of the same proposition.
- Each meaning unit is explicitly CURRENT, HISTORICAL or MIXED. Current meaning cannot have a historical primary home and historical meaning cannot have a current-only primary home.
- Each proposed topic is explicitly CURRENT, HISTORICAL or MIXED.
- Every mapping carries a semantic-fidelity check. STRENGTHENED, WEAKENED, INFERRED and TEMPORAL_SHIFT mappings invalidate the proposal.
- Structural review is explicitly told that "partner could be a good mother / available for children" does not mean "partner wants a family", and that current readiness concerns do not become relationship history merely because historical material appears nearby.

## Scope

Read-only experiment only. No schema migration and no authoritative knowledge is written.
