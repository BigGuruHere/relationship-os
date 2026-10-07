# Stage 8.12.13.8.3.1 - Structural contamination detection

This stage strengthens the read-only topic restructuring experiment after the first structural review proved too conservative.

## What changed

- Every prior topic must now receive an explicit structural contamination audit before the model proposes the cleaner topic structure.
- The audit checks for:
  1. multiple semantically distinct enduring concepts,
  2. concepts that could evolve independently,
  3. concepts whose main meaning belongs elsewhere,
  4. topic-name/content mismatch, and
  5. duplicated meaning across topics.
- `KEEP` is no longer the default. A topic may be kept only when its audit says it is coherent, has no contamination flags or cross-topic overlap, and recommends `KEEP`.
- If the audit detects contamination, the proposal must use `NARROW`, `SPLIT`, `MOVE`, `MERGE`, `RENAME`, or `RECLASSIFY` instead.
- The review UI now displays the contamination audit so a reviewer can see why a topic was kept or restructured.
- Topic restructuring remains structural and read-only. It cannot add facts, resolve contradictions, change uncertainty, grant permissions, or rewrite historical versions.

## Why

The previous review could describe a topic as conceptually mixed but still return `KEEP`. This stage makes that internally inconsistent result fail validation rather than silently pass.

## Database

No migration and no database writes.
