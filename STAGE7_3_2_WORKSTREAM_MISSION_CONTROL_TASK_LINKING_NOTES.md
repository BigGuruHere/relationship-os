# Stage 7.3.2 - Workstream Mission Control + Task Linking

## Purpose

Make Workstreams a first-class daily operating surface and make historical/future Task -> Want/Offer linking practical even when the account contains thousands of Wants or Offers.

## Changes

### First-class Workstreams navigation
- Added **Workstreams** to the desktop navigation.
- Added `/workstreams` as a daily operational dashboard.
- Defaults to active Workstreams.
- Supports search, Project filtering, status filtering and sorting by attention, recent activity, Project or name.
- Shows open/overdue tasks, active Wants, active Offers, active Leads, linked Deals and the next task for each Workstream.
- Workstream status can be changed between Active, Paused and Completed from the dashboard.
- Archiving remains on the Project workflow because archiving also detaches linked records safely.

### Workstream mission control
- Existing Project Workstream workspace is now explicitly presented as **Workstream mission control**.
- Added top-level Next actions.
- Added verified People and Companies involved.
- Added Recent activity across Tasks, Leads, Wants, Offers, Deals and Notes.
- Added a direct return to the all-Workstreams dashboard.
- Workstream status can be edited alongside name and objective/context.
- Quick-created Tasks can link directly to Wants/Offers already in that Workstream.

### Scalable Task -> Want/Offer linking
- Task Edit now includes searchable Want and Offer pickers.
- Initial suggestions are ranked using existing Task context:
  - same Workstream
  - same Project
  - same Contact
  - same Company
  - same Deal
  - current existing link
  - active status / importance / recency tie-breakers
- Free-text search happens server-side and returns only a small ranked result set.
- Because Want/Offer text is encrypted at rest, search decrypts only a bounded tenant-scoped candidate set on the server and never exposes the full database list to the browser.
- Selecting a Want/Offer can inherit missing Task context on save, but conflicting explicit context is rejected rather than silently overwritten.
- Task detail Workstream links now open the Workstream mission-control page directly.

## Database impact

**No Prisma schema change and no new migration.**

Stage 7.3.2 uses the existing `Task.wantId`, `Task.offerId`, ProjectWorkstream, Want and Offer fields. There is no data reset, destructive migration or automatic historical guessing.

## Historical tasks

Existing Tasks remain unchanged until deliberately linked. For the current small historical set, open each Task -> Edit -> choose/search the relevant Want or Offer -> Save. This preserves the Task's original identity, dates, notes and history.
