# Stage 8.8.4 - Inline Lead Working Fields

## Purpose

Stage 8.8.4 removes another piece of friction from the active calling workflow.

The lead Details panel already showed the operational fields used while working through a calling batch, but most of them could only be changed by opening the full Edit Lead form. This release makes those operational fields directly editable and autosaving in the Details panel.

Identity and contact information remains Edit Lead only.

## Quick-edit fields

The following fields can now be changed directly in the existing Details panel:

- Usual communication
- Contact attempt
- Last contacted
- Buyer status
- Seller status
- Priority, using the existing 1-5 stepper
- Confidence
- Next action

Select/date/number controls autosave on change. Next action autosaves when the field changes or when Enter is pressed.

Each quick update is still scoped to the current owner and ContextSpace through the normal Stage 8.6 request custody path.

## Fields deliberately excluded

The quick-edit allowlist does not include identity/contact fields such as:

- person name
- company name
- email
- phone
- website
- LinkedIn
- role/title
- geography
- address
- source
- lead status

Those remain editable only through Edit Lead.

This boundary is encoded in `src/lib/leadQuickFields.ts` rather than relying only on which controls happen to be rendered in the UI.

## Autosave behaviour

Quick controls use SvelteKit enhanced form actions, so saving does not reload the lead page.

The server validates every field independently:

- communication/contact/buyer/seller values must be from the existing option sets;
- Last contacted must be a valid date/time or blank;
- Confidence must be a whole number from 0 to 100;
- Next action is encrypted with the existing `market_lead.next_action` AAD before storage.

A short `Saving...` / `Saved` indicator is shown beside the field.

## Full Edit Lead compatibility

The full Edit Lead form now renders the current locally saved operational values. This prevents a later full-form save from accidentally restoring stale values that were changed through the quick panel.

## Working queue compatibility

Stage 8.8.4 keeps the Stage 8.8.2 and 8.8.3 behaviour unchanged:

1. open a lead from a filtered Batch;
2. update operational fields directly;
3. lower Priority when appropriate;
4. add/edit/delete Lead Notes without losing the queue;
5. click Return to list;
6. the exact filtered queue reloads and is freshly ordered by the updated priority.

## Database and migrations

Stage 8.8.4 adds no migration relative to Stage 8.8.3.

The entire migration directory is byte-for-byte identical to Stage 8.8.3.

If Stage 8.8.3 has not yet been installed, the package still contains its pending migration:

```text
20260907133500_stage8_8_3_import_batch_filtering
```

That migration is for Source versus Batch classification and is not changed by 8.8.4.

## Tests

Focused Stage 8.8.1 through 8.8.4 verification completed in the package environment:

```text
16 / 16 passing
```

Stage 8.8.4 itself:

```text
5 / 5 passing
```

Mutation proof:

- `phone` was deliberately added to the quick-edit allowlist;
- the Stage 8.8.4 boundary test failed as intended;
- the allowlist was restored;
- Stage 8.8.4 returned to 5/5 passing.
