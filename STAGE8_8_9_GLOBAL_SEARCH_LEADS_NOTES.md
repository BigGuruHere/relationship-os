# Stage 8.8.9 - Global Search Includes Leads

## Purpose

The main `/search` page was created before `MarketLead` existed. Stage 8.8.9 makes Leads a first-class part of global Search without changing the database schema.

## What changed

- Added **Leads** to the Search scope dropdown.
- `All` search now includes MarketLeads.
- Lead result cards link directly to `/leads/{id}`.
- Lead search covers:
  - title
  - person/name
  - company name
  - email
  - phone
  - website
  - LinkedIn
  - role/title
  - geography
  - address
  - description
  - legacy lead notes field
  - Next Action
  - lead type/status/source
  - custom source/import batch name
  - linked Company name
  - linked Contact name
  - Project and Workstream names
- Separate time-stamped `MarketLeadNote` records are searched too, including research, call, LinkedIn and other lead notes.
- The existing **Notes** scope now also returns matching Lead Notes, not only Contact Interaction notes.

## Search/security behaviour

Lead PII and notes remain encrypted at rest. Search therefore uses:

1. deterministic indexes for exact equality matches where indexes already exist, then
2. a bounded, tenant-and-ContextSpace-scoped decrypt scan for partial text matching.

The bounded scans are limited to 5,000 MarketLead rows and 5,000 MarketLeadNote rows per search. This fits the current Relish scale while avoiding an unbounded decrypt-everything search path. If Relish grows substantially beyond this, dedicated searchable encrypted indexes or embeddings should be considered rather than raising the bound indefinitely.

## Database impact

None.

- `prisma/schema.prisma` is byte-for-byte unchanged from Stage 8.8.8.
- Existing migration SQL is unchanged.
- No new migration is required.

## Verification

Focused Stage 8.8.9 checks: 6/6 passing.

Stage 8.8.1 through 8.8.9 focused regression stack: 48/48 passing.

A mutation test removed the `MarketLeadNote` search path. The Stage 8.8.9 regression test failed as intended, then returned to green after restoration.
