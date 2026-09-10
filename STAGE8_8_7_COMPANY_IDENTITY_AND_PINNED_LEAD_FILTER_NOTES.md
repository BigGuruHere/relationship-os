# Stage 8.8.7 - Company Identity + Pinned Lead Working Filter

## Purpose

This is a small usability and identity release based on live use of the lead workflow.

It adds three things:

1. optional Company external identifiers in the normal Company UI;
2. safer duplicate warnings for Companies whose names differ only by common legal-name formatting;
3. one pinned Lead working filter plus a collapsed-by-default filter panel.

No new Prisma model or migration is introduced.

## Company identity

### External identifiers are optional

A Company can still be created with only a name. ABN, ACN, ASQA RTO registration, aged-care provider ID, or another external identifier are supporting identity evidence when available, not a requirement.

The Company create form now includes an optional external identifier area:

- identifier type;
- identifier value;
- optional source URL.

The Company detail page always shows an External identifiers panel where identifiers can be added or removed later.

### Duplicate behaviour

The duplicate hierarchy is intentionally conservative:

- matching external identifier: authoritative conflict, creation is blocked;
- matching ABN/ACN with formatting-only differences: authoritative conflict;
- same name, phone or website: warning only;
- common legal-name variant, for example `ABC Training` versus `ABC Training Pty Ltd`: warning only;
- genuinely different names such as `ABC Health` and `ABC Healthcare`: no automatic match.

Relish never automatically merges Companies because their names look similar.

## Lead working filter

### Collapsed by default

The Lead filter form now starts collapsed. Click `Filters` to expand it when building a new search.

When a filter is already applied, its current criteria are summarized in the collapsed header.

### Pin current filter

An applied Lead filter can be pinned as the current working list.

The pinned card appears above the filter section and provides:

- `Open` to restore the exact pinned filter;
- `Unpin` to remove it.

Stage 8.8.7 deliberately supports one pinned working filter rather than introducing a full saved-search subsystem.

The pin is stored in browser storage, keyed by Relish user and ContextSpace, so another Relish account using the same browser does not inherit it.

Only a filter that has actually been applied can be pinned. Unsaved changes in an expanded filter form do not silently replace the pin.

## Database impact

None.

- `prisma/schema.prisma` is unchanged from 8.8.6.
- Existing migration SQL files are unchanged.
- `CompanyExternalIdentifier` from Stage 8.8 is reused.

## Verification performed

- Stage 8.8.1 through 8.8.7 focused Node source tests: 37/37 passing before final packaging changes; Stage 8.8.7 re-run after the final pin logic adjustment: 8/8 passing.
- Modified TypeScript server/helper files pass Node 22 strip-types syntax checking.
- Mutation proof: deliberately changing the Lead filter to start expanded causes the new Stage 8.8.7 regression test to fail.
- Prisma schema and migration SQL compared byte-for-byte against 8.8.6: unchanged.

The isolated build container could not complete `npm ci` because package downloads were unavailable (`EAI_AGAIN`), so `npm run check` / Svelte compilation must be run in the normal development environment after installation.
