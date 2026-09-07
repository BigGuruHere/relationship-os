# Stage 8.8.3 - Lead Batch Filter + Note Return Context

## Purpose

Stage 8.8.3 is a small workflow correction based on using imported calling batches in the real Leads UI.

It fixes two issues:

1. saving, editing, or deleting a Lead Note previously dropped the filtered working-list return context;
2. imported calling batches were stored as custom `LeadSource` records and therefore accumulated inside the general Source filter.

## Behaviour

### Lead note navigation

All three note actions now carry the existing `returnTo` value:

- create Lead Note
- update Lead Note
- delete Lead Note

After the action, the lead detail page still knows the exact Leads URL it was opened from. `Return to list` therefore restores the same batch/search/status/contact-attempt/project/workstream filters and reloads the queue using the current priority ordering.

### Source versus Batch

The Leads filter now distinguishes two concepts:

- **Source** - where/how the lead originated, for example Manual, Referral, Research, Imported, LinkedIn or a named custom source.
- **Batch** - the operational imported slice currently being worked, for example `RTO Hot 50 - Batch 2`.

`Imported` therefore remains useful as a Source filter across every imported lead, while Batch selects one exact imported calling slice.

### Compatibility storage

This stage deliberately does not introduce another LeadList model. Existing `MarketLead.leadSourceId` links remain in place. `LeadSource` receives a small classification field:

```text
SOURCE
IMPORT_BATCH
```

The importer now creates/resolves records as `IMPORT_BATCH`. Ordinary custom sources continue to be `SOURCE`.

### Existing Stage 8.8 imports

The migration backfills previously imported Stage 8.8 batch sources to `IMPORT_BATCH` when they are used by `IMPORTED` MarketLeads linked to a `CompanyExternalIdentifier`.

No MarketLead, Company, MarketLeadNote, CompanyExternalIdentifier, tag, project or workstream row is deleted or moved.

## Migration

New forward migration:

```text
20260907133500_stage8_8_3_import_batch_filtering
```

It:

- creates `LeadSourceKind`;
- adds `LeadSource.kind` with default `SOURCE`;
- marks existing Stage 8.8 imported batches as `IMPORT_BATCH`;
- adds an index supporting owner/context/kind filtering.

It contains no `DROP TABLE`, `DELETE`, or `TRUNCATE` operation.

## Tests

Source-level verification completed in the package environment:

```text
Core tests:      150 / 150 passing
Stage 8.8.3:       5 / 5 passing
```

Mutation proof:

- the import-batch classifier was deliberately weakened so every item was treated as a normal Source;
- the Stage 8.8.3 behavioural test failed;
- the original classifier was restored;
- Stage 8.8.3 returned to 5/5 passing.

## GUI acceptance check

A practical test is:

1. filter Leads to one imported Batch;
2. open the first lead;
3. add a Lead Note;
4. lower priority if appropriate;
5. click Return to list;
6. confirm the same Batch remains selected and the refreshed queue reflects the new priority ordering.

Also confirm imported batch names now appear under **Batch**, not among ordinary **Source** options.
