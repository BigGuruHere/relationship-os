# Stage 8.12.13.6 - Topic-aware Living Understanding revision experiment

## Purpose

This stage changes the read-only revision experiment from "pick a topic first" to a two-step topic-aware flow:

1. Dorian reads the authorised source plus the person's current topic inventory and proposes which existing topic understandings appear materially affected.
2. The operator chooses which proposed topics to test. Dorian then produces a topic-specific revised understanding and statement-level change record for each selected topic.

Nothing from this experiment is persisted.

## Evidence change

The model no longer needs to reproduce an exact evidence quotation for the new experiment. Conversation turns are assigned transient IDs such as `T003`. The model returns those IDs and Relish resolves the exact source turn locally. A turn from another speaker cannot validate a claim about the selected person.

## Privacy and custody

- The existing owner, ContextSpace and contact checks run before source or current claims are decrypted.
- The experiment remains disabled in production and requires `DATING_REVISION_EXPERIMENT=YES`.
- Each model-processing step requires explicit consent in the UI.
- Topic IDs returned by the model or browser are checked against the authorised person's topics before use.
- No revision, topic suggestion, statement, permission or disclosure state is written to the database.
- Model invocation auditing remains content-redacted under the existing sensitive-data audit path.

## Scope limits

This is deliberately a bounded experiment. It stops instead of silently truncating when topic, claim or source limits are exceeded. At most six topics can be revised in one operator-requested run.

## No migration

There is no Prisma migration in Stage 8.12.13.6.
