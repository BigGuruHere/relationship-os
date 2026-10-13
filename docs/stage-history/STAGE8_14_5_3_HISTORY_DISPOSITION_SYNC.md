# Stage 8.14.5.3 - Conversation History Disposition Sync

Fixes Conversation History so an explicit Review Inbox dismissal is shown authoritatively as dismissed.

- Batch-loads review dispositions for the participant's conversation sources.
- Explicit DISMISSED workflow state overrides the derived LU handoff badge in history.
- Marks participant-history page data `cache-control: no-store` so review state is refreshed rather than served stale.
- Renames the storage badge from `Stored in Relish` to `Imported` for clearer historical status.
- No schema or migration change.
