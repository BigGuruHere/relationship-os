# Stage 7.3 - First-class Wants

This release makes Wants a first-class working object instead of only an `ExchangeItem` type.

## Product decision

- `Want` is now the demand-side object: buyer mandates, acquisition criteria, search briefs, and “keep an eye out” requests.
- `ExchangeItem` remains for OFFER records for now.
- Existing `ExchangeItem` rows where `type = WANT` are copied into the new `Want` table during migration.
- Existing `Company.criteriaEnc` records are copied into `Want` as `ACQUISITION_CRITERIA` so acquisition criteria stops being a separate parallel concept.
- The old `ExchangeItem` WANT rows are not deleted. They are retained for safe rollback/read compatibility, but normal entity panels now show first-class Wants separately from Offers.

## New user-facing features

- New `/wants` list page.
- New `/wants/[id]` detail/workspace page.
- Wants can link to:
  - Contact
  - Company
  - Deal
  - Project
  - Workstream
  - Company-contact relationship
- Wants have:
  - Want type
  - Status
  - Description
  - Criteria
  - Category
  - Geography
  - Value range
  - Review/expiry dates
  - Notes
  - Tasks
  - Convert to deal action
- Contacts, companies, deals, projects and company-contact relationship pages now show a first-class Wants panel.
- The previous `ExchangeItemsPanel` is now offer-focused.
- Lead → Convert to want now creates a `Want`, not an `ExchangeItem WANT`.
- Tasks can link directly to a Want.

## New Want statuses

- New
- Clarifying criteria
- Active mandate
- Watching market
- Matched
- Converted to deal
- Closed / inactive
- Archived

## New migration

`20260824084000_stage7_3_first_class_wants`

## Follow-up stages

This stage deliberately does **not** build the matching engine yet. The next logical stage is:

- Stage 7.4: Match Wants against OFFER `ExchangeItem` rows using pgvector/cosine similarity plus practical filters.
- Stage 7.5: Match review/action workflow.
