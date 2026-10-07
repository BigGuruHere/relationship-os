# Stage 8.8.1 - Lead Priority Quick Control

## Purpose

Stage 8.8.1 is a small usability release for working active calling batches quickly. It does not change the meaning of MarketLead priority or Contact Attempt status.

The existing Leads list already orders leads by status, then priority descending, then most recently updated. During outreach, lowering a lead from priority 3 to 2 therefore moves it below untouched priority-3 leads when the user returns to the list.

## Changes

- Adds a compact Priority stepper to the individual Lead header.
- Down arrow lowers priority by one.
- Up arrow raises priority by one.
- Priority remains constrained to the existing 1-5 range.
- Changes autosave through a dedicated `quickPriority` SvelteKit action.
- The page updates the displayed priority without a full reload.
- The normal Edit Lead form uses the newly saved priority, preventing a later edit from restoring a stale value.
- Existing Contact Attempt, lead status, qualification, project/workstream and import behaviour are unchanged.

## Security / custody

The write uses the existing authenticated lead route and remains scoped by `userId`; Stage 8.6 ContextSpace custody scoping continues to apply through Prisma. No cross-owner or external-custody path is introduced.

## Database

No Prisma schema change. No migration. No data backfill.

## Tests

A focused behavioural test covers:

- priority 3 -> 4
- priority 3 -> 2
- priority cannot rise above 5
- priority cannot fall below 1

The boundary test was mutation-checked by temporarily removing the clamp; the test failed (`6 !== 5`) and passed again after restoration.
