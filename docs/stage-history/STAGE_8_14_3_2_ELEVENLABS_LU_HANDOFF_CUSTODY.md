# Stage 8.14.3.2 - ElevenLabs LU handoff custody hotfix

## Problem

Stage 8.14.3 added a read-only Living Understanding handoff immediately after a successfully attached ElevenLabs conversation. The external ingest custody policy still permitted only Interaction and Contact operations, so the new handoff failed on `LivingUnderstandingRevision.findFirst`.

## Fix

The named `ELEVENLABS_CONVERSATION_INGEST` cross-custody policy now additionally permits:

- `LivingUnderstandingRevision.findFirst`
- `LivingUnderstandingRevisionSource.findFirst`

These are the exact two read operations used by `describeLivingUnderstandingReviewHandoff()`.

No LU write operation is permitted. The webhook still cannot create, update, approve, retire or delete Living Understanding state.

## Migration

None.
