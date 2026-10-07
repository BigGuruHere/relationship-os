# Stage 8.12.13.8.1 - Topic-bounded longitudinal evolution

## Purpose

This development-only, read-only patch tightens the longitudinal Living Understanding experiment after the first two-conversation test.

## What changed

- The semantic boundary that produced each baseline topic is now carried into the longitudinal seed.
- Longitudinal classification is told not to import later evidence whose main meaning belongs to a neighbouring topic.
- If later evidence introduces a different enduring area, the model should suggest a new topic instead of expanding an unrelated prior topic.
- Per-topic longitudinal revision receives the prior semantic boundary and neighbouring-topic exclusion hints as hard scope constraints.
- New persistent operational knowledge now has a stricter threshold: it should be proposed only where a proposition genuinely needs its own persistent matching, permission, disclosure, verification, retrieval or action rule.
- Conversation-level choices such as "do not search yet" or "keep exploring" are separated into temporary interaction state instead of being proposed as enduring person knowledge.
- The UI displays temporary interaction state separately from persistent operational knowledge.
- Existing no-silent-drop rules, explicit longitudinal effect classifications, source-turn validation, custody checks and read-only behavior remain unchanged.

## Persistence

Nothing in this experiment is written to the database. No understanding, topic, operational unit, interaction state, permission or sharing rule is persisted.

## Database

No migration is included.

## Verification performed in the packaging environment

- Focused revision experiment tests passed 37/37.
- All core `.test.mjs` regression tests passed 154/154 with Node type stripping.
- Changed TypeScript server files passed Node type-stripping syntax checks.
- The revision policy module passed JavaScript syntax checks.
- `npm test` was attempted and could not start because `tsx` is not installed in the packaging environment.
- Live model calls, Svelte compilation, full project check/build, database tests and browser acceptance were not available here.
