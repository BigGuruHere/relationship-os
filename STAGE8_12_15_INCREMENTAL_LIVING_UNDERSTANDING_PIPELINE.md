# Stage 8.12.15 - Incremental Living Understanding Pipeline

This stage changes failure handling rather than changing the core Living Understanding model.

## Why

The previous experiment treated a structural review as one all-or-nothing model response. A single missing ownership assignment could invalidate a long chain of successful source comparisons and force the operator to repeat roughly ten minutes of work.

## What changes

- Successful comparison state is stored as a short-lived, encrypted, non-authoritative `LivingUnderstandingDraft` checkpoint.
- Drafts are scoped to owner, ContextSpace and contact and retain only derived working state plus authorised source IDs. They expire after 24 hours.
- Before structural review, the latest comparison state is checkpointed.
- If structural validation still fails after the existing bounded repair pass, the UI offers `Retry structural review only` from that checkpoint. Earlier source comparisons do not have to be repeated.
- A saved structural checkpoint can also be resumed after reopening the experiment page while it remains unexpired.
- Draft checkpoints are marked completed after authoritative adoption. They never become authoritative knowledge by themselves.
- The 8.12.15 validation contract can resolve missing primary-home metadata from a declared semantic identity group when one validated primary home already exists and the group's canonical meaning is present in that destination topic. This fixes metadata failures without duplicating prose or asking the model to regenerate the whole structure.

## Trust boundary

Authoritative Living Understanding remains unchanged. Only a validator-clean proposal can produce an adoption token, and only explicit operator approval persists an authoritative revision.

A working checkpoint is not confirmation, not permission, not disclosure consent and not matchable knowledge.
