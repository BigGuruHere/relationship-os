# Stage 8.14.5.2 - Review Surface Consolidation

## Purpose

Separate conversation history from the operational Living Understanding review queue.

## Behaviour

- General participant page now presents `Conversation history` as an archival chronological record.
- Every history entry shows that the conversation is stored in Relish plus its current Living Understanding status.
- Statuses distinguish pending initial review, pending impact review, dismissed review, and inclusion in authoritative Living Understanding history.
- Review, dismiss, and restore actions are removed from the participant history page.
- The General `Review inbox` remains the single operational surface for Review, Dismiss, and Restore decisions.
- Dismiss still requires browser confirmation before submission.
- A dismissed conversation remains stored and visible in conversation history.

## Persistence

No schema or migration change.
