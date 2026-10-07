# Stage 8.12.13.7.2 - Topic-bounded Living Understanding revision

This remains a development-only, read-only experiment.

## Purpose

Stage 8.12.13.7.1 correctly decomposed one conversation into distinct semantic areas, but a long source turn could still contain several ideas. A topic revision could therefore pull neighbouring material into the wrong Living Understanding even when the decomposition itself was correct.

This patch tightens only that boundary.

## Changes

- A semantic-area revision now requires at least one validated target-speaker source turn. It never falls back to the complete transcript.
- The decomposition reason is passed forward as a semantic scope boundary.
- Other selected semantic areas are supplied as exclusion hints only. They are not evidence.
- The revision prompt explicitly tells the model that a supplied turn can contain several ideas and to use only the clauses that belong to the current topic.
- Operational knowledge instructions now split compound units only when the components could reasonably have different matching, permission, disclosure, verification, retrieval, or action rules.
- No understanding, topic, statement, permission, or sharing rule is persisted.

## No database migration

This stage changes no Prisma schema or migration.
