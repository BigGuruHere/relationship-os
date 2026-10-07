# Stage 8.12.13.8.3 - Read-only topic restructuring

This stage adds a structural review after longitudinal evolution. It is intended to detect and repair topic-boundary contamination that has been faithfully carried forward from an earlier baseline.

The review can propose keeping, narrowing, splitting, merging, moving, renaming or reclassifying topics. It must preserve every prior topic's meaning somewhere in the proposed structure and may not add facts, remove facts, resolve contradictions or change uncertainty.

The server re-authorises every source in the temporary baseline provenance before external model use. The proposal remains read-only and does not write topics, understandings, statements, permissions, sharing rules or historical versions.

No database migration is required.
