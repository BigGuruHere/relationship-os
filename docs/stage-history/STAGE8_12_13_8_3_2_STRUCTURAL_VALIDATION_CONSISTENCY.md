# Stage 8.12.13.8.3.2 - Structural validation consistency

This stage is a targeted read-only correction to the topic restructuring experiment.

## Changes

- Normalizes KEEP coherence from the audit facts so a contradictory model boolean cannot create a false validation warning when there are no contamination flags, no overlapping topics, the recommendation is KEEP, and the title still fits the current state.
- Adds an explicit current-state title-fit test to every topic audit.
- Requires a non-KEEP operation when a topic title asserts a superseded or outdated current position.
- Encourages neutral durable titles for evolving topics, for example `Having more children` rather than `Desire to have children again` after that desire has been superseded.
- Shows title-fit status and any title concern in the restructuring UI.

## Safety

No database migration. No topic, understanding, statement, permission, sharing rule, historical version, or temporary interaction state is persisted by this experiment.
