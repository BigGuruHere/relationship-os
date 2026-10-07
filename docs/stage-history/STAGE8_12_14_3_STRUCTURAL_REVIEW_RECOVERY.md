# Stage 8.12.14.3 - Structural Review Recovery

This stage adds one bounded validator-guided repair pass to the read-only Living Understanding structural review.

## Why

Live testing showed that a model can return a structurally useful proposal while omitting required meaning-unit inventories, overlap groups, or internally consistent KEEP/coherence fields. The deterministic validator correctly blocks adoption, but repeatedly asking the operator to rerun the whole chain is not a production-quality recovery path.

## Behaviour

1. The first structural review is validated exactly as before.
2. If it is validator-clean, no repair call is made.
3. If it fails deterministic validation, Relish performs exactly one repair call.
4. The repair receives the original current topic understandings, the invalid structured review, and the exact validator failures.
5. The repair prompt is explicitly forbidden from reconsidering or changing person meaning. It may only complete or correct the structural contract.
6. The repaired response is validated from scratch with the same deterministic validator.
7. Only a validator-clean repaired response can receive an adoption token.
8. If the repair remains invalid, the proposal remains read-only and blocking warnings are shown.

The UI indicates when a validator-guided repair was attempted and whether the repaired result passed.

No database migration is included in this stage.
