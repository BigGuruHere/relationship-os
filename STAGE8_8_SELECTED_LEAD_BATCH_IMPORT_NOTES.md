# Stage 8.8 - Selected Lead Batch Import + External Company Identity

## Purpose

Stage 8.8 supports the current commercial workflow without turning Relish into a wholesale copy of external market registers.

The intended flow is:

```text
Master market spreadsheet
2,000 aged-care records / 3,000+ RTO records
        |
external research and selection
        |
selected hot slice, typically about 50 rows
        |
Relish import
        |
existing MarketLead workflow
        |
call, qualify, follow up, convert where appropriate
```

This stage deliberately reuses the existing `MarketLead`, `MarketLeadNote`, `LeadSource`, Project, Workstream and Tag machinery. It does not add a separate `LeadList` or import the complete source universe.

## Product behaviour

A new **Leads -> Import leads** page accepts a CSV containing the selected batch.

The import page lets the user specify:

- batch / calling-list name,
- external identifier scheme, such as `ASQA_RTO`, `AGED_CARE_PROVIDER`, `ABN` or `ACN`,
- Project,
- Workstream,
- Company tags,
- initial lead type,
- initial lead status,
- priority,
- CSV column mappings.

The existing custom `LeadSource` model is used as the first-stage batch label. This makes a batch immediately filterable on the existing Leads page without creating another list abstraction.

The first version accepts up to 500 rows per upload. The UI explicitly encourages importing the selected hot slice rather than the 2,000 to 3,000 row source register.

## Stable Company identity

Stage 8.8 adds:

```text
CompanyExternalIdentifier
```

The model is context-scoped and stores:

- owning User,
- ContextSpace,
- Company,
- identifier scheme,
- encrypted identifier value,
- deterministic equality index,
- optional encrypted source URL.

Examples:

```text
ASQA_RTO / 12345
AGED_CARE_PROVIDER / ABC987
ABN / 12345678901
```

The uniqueness boundary is:

```text
userId + contextSpaceId + scheme + valueIdx
```

This means the same source/code pair resolves to one Company inside one Workspace ContextSpace.

The identifier value itself is encrypted. The deterministic HMAC index is used for equality resolution.

## Company matching rules

For each imported row Relish resolves the Company in this order:

1. Find `CompanyExternalIdentifier` by owner + ContextSpace + scheme + external code.
2. If found, reuse that Company.
3. If no external identifier exists, look for an exact encrypted-index Company-name match in the active ContextSpace.
4. If exactly one Company matches by name, reuse it and attach the new external identifier.
5. If more than one existing Company has that exact name, fail that row rather than guessing.
6. If no Company matches, create the Company and its external identifier.

This exact-name fallback is intentionally only a bridge for Companies created before Stage 8.8. Future cross-batch identity should normally resolve through the external identifier.

When an existing Company is reused, the importer may fill currently blank phone, website and location fields from the CSV. It does not replace existing non-empty values during this first version.

## Same batch vs later batch

A Company may legitimately appear in multiple selected calling batches.

Stage 8.8 therefore treats these differently:

```text
Same Company + same batch
    -> reuse Company
    -> do not create another MarketLead
    -> do not append the same imported research again

Same Company + later batch
    -> reuse Company
    -> create a fresh MarketLead
    -> append the new batch research as a fresh MarketLeadNote
```

The same-batch idempotency key is effectively:

```text
user + ContextSpace + Company + LeadSource(batch)
```

No historical research is overwritten.

## Imported research

Research supplied by Claude, GPT or another pre-import research process is stored as an append-only `MarketLeadNote` with:

```text
channel = research
```

The note body retains lightweight provenance:

- import batch name,
- CSV filename,
- spreadsheet row number,
- external identifier scheme and value,
- optional research provider,
- optional research date,
- optional source URL,
- research text.

This keeps the research attached to the particular lead/call context that caused it to be imported.

The linked Company page also surfaces prior imported lead research by traversing its MarketLeads. The research is not copied into `CompanyNote`, so there is one authoritative copy rather than duplicated notes that can diverge.

## Link back to the spreadsheet/source

Stage 8.8 preserves two complementary references:

1. **Real-world source identity** through `CompanyExternalIdentifier`, for example `ASQA_RTO / 12345`.
2. **Import occurrence provenance** inside the Research note, including CSV filename and spreadsheet row number.

This means a later batch can recognise the same Company even if the Company name changes slightly, while a human can still trace a particular piece of imported research back to the file/row that supplied it.

## Contacts

The importer does not create `Contact` records merely because a CSV has a person name, title, email or phone.

Those values remain on the `MarketLead` during the lead stage. Existing conversion machinery can create or link durable Contact records later when the relationship warrants it.

This avoids polluting the relationship graph with unqualified spreadsheet people.

## Project, Workstream and Tags

- Project and Workstream are attached to the MarketLead using existing lead machinery.
- Selected tags are applied to the linked Company.
- The custom LeadSource is the batch/calling-list label.

No new parallel workflow taxonomy was introduced.

## Security and custody

`CompanyExternalIdentifier` is a direct ContextSpace-scoped model.

The Stage 8.8 migration installs the same database protections established by Stage 8.6:

- owner/context consistency trigger,
- custody reassignment guard,
- cross-context Company foreign-key guard.

`CompanyExternalIdentifier` is also included in the Prisma custody interceptor model set.

The Stage 8.6 guard audit now covers 45 direct ContextSpace models and 112 direct scoped foreign keys, with the new CompanyExternalIdentifier -> Company relation included.

## Migration

New migration:

```text
20260904184000_stage8_8_lead_batch_import
```

It only:

- creates `CompanyExternalIdentifier`,
- creates its unique/index structures,
- adds its User, ContextSpace and Company foreign keys,
- installs the custody/owner/reference triggers.

It does not delete or rewrite existing Company, MarketLead, MarketLeadNote or Contact data.

## 8.8 v2 index-name alignment

After the first dev application, PostgreSQL exposed a naming-only drift on the long `CompanyExternalIdentifier` unique index. PostgreSQL identifiers are limited to 63 bytes, so the explicit migration name was truncated by PostgreSQL to:

```text
CompanyExternalIdentifier_userId_contextSpaceId_scheme_valueIdx
```

Prisma's default generated name truncates the same logical unique constraint differently, which caused `prisma migrate dev` to offer a rename-only migration after Stage 8.8 had already applied.

The Prisma `@@unique` now uses an explicit `map:` to the actual PostgreSQL index name. The already-applied Stage 8.8 migration is unchanged and no corrective database migration is required. This also keeps a fresh production deployment aligned after PostgreSQL performs the same deterministic identifier truncation.

## Verification

Source-level Core suite in the packaged source:

```text
139 / 139 passing
```

Stage 8.8 source tests:

```text
9 / 9 passing
```

The real PostgreSQL checker `npm run check:stage8.8` exercises the actual importer and is designed to prove:

- first selected batch creates Company identity, MarketLead and Research note,
- same-batch re-import is idempotent,
- a later batch reuses Company but creates a new MarketLead and Research note,
- a single legacy exact-name Company can receive a new external identifier,
- ambiguous legacy name matches fail closed,
- duplicate external identifiers are rejected,
- an external identifier cannot reference a Company in another ContextSpace,
- temporary verification data is removed.

The real PostgreSQL checker cannot be executed in the packaging environment because it does not have the user's Neon credentials. It must be run against dev after the migration is applied.

## Explicitly not included

Stage 8.8 does not add:

- bulk ingestion of all 5,000 source records,
- LeadList / ProspectList,
- agent-driven lead selection or autonomous import,
- automatic replacement/merging of ambiguous Companies,
- automatic Contact creation from spreadsheet names,
- research overwrites,
- consent/disclosure,
- PotentialMatch or matching,
- Dorian v2.

## Why deterministic import comes before an agent

Claude/GPT may continue doing the research and helping select the hot 50 externally.

Relish first needs a deterministic, auditable operation that says:

```text
These are the records I have approved for active pursuit.
Import them using these identity, batch and workflow rules.
```

A future agent can call the same capability once agent permissions, preview and approval behaviour are understood. The agent should not invent Company identity or import semantics.

## Roadmap position

The roadmap has been deliberately reprioritised around current commercial use:

```text
8.6 ContextSpace custody foundation
8.7 Cross-custody execution boundary
8.8 Selected lead batch import + external company identity
8.9 Consent/disclosure foundation - gated by a real second-person case
8.10 Manual PotentialMatch - gated by real matching evidence
8.11 Progressive bilateral disclosure
8.12 Matchable projections
9.0 Controlled network matching
```

Consent and matching remain architectural commitments, but neither should be built merely because it previously had the next stage number.
