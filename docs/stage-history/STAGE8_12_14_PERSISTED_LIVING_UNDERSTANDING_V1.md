> **Superseded for deployment:** Stage 8.12.14 persistence was development-only and never reached production. Stage 8.13.0 replaces its unreleased migration chain with the canonical longitudinal persistence migration.

# Stage 8.12.14 - Persisted Living Understanding v1

This stage converts the validated read-only Living Understanding experiment into an operator-authorised, immutable persistence path.

## Architectural contract

- The authoritative representation is encrypted human-readable text.
- Embeddings are intentionally not stored in the authoritative revision tables. They will be derived indexes that can be regenerated without changing knowledge.
- A validated structural review can be approved by the operator and saved as a new revision.
- Earlier revisions are immutable and retained.
- Every saved revision retains the authorised source interaction IDs and source dates.
- Stable topic identities are separate from topic-version rows so a future embedding can point to the exact version it represents.
- Saving understanding does not grant discovery, matching, approach, disclosure or sharing permission.

## Security

The browser-carried approval envelope is HMAC protected, scoped to owner + ContextSpace + contact, expires after two hours, and is idempotent. Every referenced source interaction is re-authorised against the same Dating custody scope immediately before the database transaction.

## Database

Migration: `20261001013000_stage8_12_14_persisted_living_understanding`

New models:

- `LivingUnderstandingRevision`
- `LivingUnderstandingTopicIdentity`
- `LivingUnderstandingTopicVersion`
- `LivingUnderstandingRevisionSource`

There is no vector column in these authoritative models.
