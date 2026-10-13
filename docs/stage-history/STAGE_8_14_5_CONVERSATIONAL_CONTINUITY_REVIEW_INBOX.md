# Stage 8.14.5 - Conversational Continuity + Living Understanding Review Inbox

## Purpose

This stage adds two distinct memory/supervision layers without changing the authority model:

1. **Conversational continuity** - ElevenLabs/Dorian receives a count of previous participant conversations and the most recent available call summary at initiation time.
2. **Review inbox** - General-context conversation evidence waiting on Living Understanding can be reviewed, dismissed with confirmation, or restored.

## Memory semantics

- Living Understanding remains durable current understanding.
- `last_call_summary` is recent conversational continuity, sourced from the ElevenLabs post-call `analysis.transcript_summary` and stored encrypted in `Interaction.summaryEnc`.
- `previous_calls` is the number of previously attached conversation sources for that participant at initiation time.
- No summary is promoted into authoritative LU merely because it is passed to Dorian.

## Dismissal semantics

Dismissal means **do not currently incorporate this source into Living Understanding**.

It does not delete the immutable conversation, erase participant evidence, or change authoritative LU. Dismissed items can be restored from the review inbox.

The UI requires explicit browser confirmation before submitting a dismissal.

## Migration

`20261013090000_stage8_14_5_conversation_review_continuity`

Adds `LivingUnderstandingSourceReviewDisposition`, a ContextSpace-owned workflow table for dismiss/restore state.
