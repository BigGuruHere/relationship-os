# Stage 8.8.6 - Next Action Real Select Fix

## Summary

Stage 8.8.6 fixes the reusable MarketLead Next Action control introduced in 8.8.5.

The 8.8.5 UI used an HTML `datalist`. A datalist is still a text input with suggestions, so after a Next Action had been saved it did not behave reliably like a normal dropdown when the user wanted to replace it with another existing option.

8.8.6 changes the interaction model to a true select for existing actions and an explicit create-new mode for free-form additions.

## Behaviour

On the lead Details panel:

- existing Next Actions appear in a real `<select>`
- choosing another existing action autosaves immediately
- `No next action` clears the value
- `+ Create new action...` swaps the select for a text field
- entering a new value and pressing Save or Enter persists it through the existing 8.8.5 taxonomy machinery
- the newly created option is added to the in-page dropdown immediately
- Cancel exits create-new mode without changing the currently saved action or triggering a blur-save

The full Edit Lead form uses the same select/create-new pattern.

## Data and schema

No Prisma schema change.
No database migration.
No changes to `LeadNextActionOption` storage, encryption, ContextSpace custody, or deduplication.

The latest migration remains:

`20260907144000_stage8_8_5_lead_next_action_options`

## Regression coverage

A new Stage 8.8.6 test asserts that:

- the old datalist implementation is absent
- existing options use a real select
- existing selections autosave through the quick-field action
- create-new mode does not submit the sentinel value
- newly saved options enter the current page's option list
- Edit Lead uses the same interaction model
- no new migration was added
