# Stage 8.12.13.7.1 - Topic target consolidation

This read-only experiment patch tightens semantic decomposition without changing the stored knowledge model.

## Changes

- A single existing topic can receive only one Living Understanding revision per experiment run.
- If several selected semantic areas still target the same topic, Relish consolidates their evidence before the model revision call.
- Repeated proposed realm/topic targets are also consolidated.
- The decomposition prompt now tells Dorian to use an existing topic at most once and to suggest a new narrow topic when a distinct enduring idea does not genuinely fit an existing topic.
- Operational knowledge remains selective and retains links to the original semantic areas.
- The UI shows when several semantic areas were combined into one topic revision.

## Safety

Nothing in this experiment is saved, confirmed, retired, moved, made discoverable, or made shareable.
No database migration is included.
