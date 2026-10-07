# Stage 8.14.1.1 - Conversation Subject Constraint Hotfix

## Problem

Stage 8.14.1 introduced the provider-independent `CONVERSATION_TRANSCRIPT` channel and `IMPORT` / `API` source types for complete multi-speaker conversation originals. The existing PostgreSQL `Interaction_subject_required` constraint from Stage 8.12.13.2 only exempted the legacy `DATING_CONVERSATION_TRANSCRIPT` + `WORKSPACE` shape. The first new import therefore failed with PostgreSQL error `23514` before person-specific source records could be created.

## Fix

A narrow forward-only migration replaces the check constraint. Subjectless interactions are permitted only for either:

- the legacy `DATING_CONVERSATION_TRANSCRIPT` + `WORKSPACE` + `dating:transcript:%` shape, or
- the canonical `CONVERSATION_TRANSCRIPT` + (`IMPORT` or `API`) + `conversation:%` shape.

Every other Interaction still requires a Contact, Person or Company subject. Existing custody and context-space constraints are unchanged.

## Deployment

Run Prisma migration deployment before retrying the import:

```powershell
npx prisma migrate deploy
```

or the project's safe development migration command where appropriate.

No data repair is required because the rejected row was never committed.
