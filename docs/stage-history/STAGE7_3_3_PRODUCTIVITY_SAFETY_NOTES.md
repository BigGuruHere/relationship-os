# Stage 7.3.3 - Productivity, Consistency & Safety

## Scope

This release is deliberately schema-free and builds on Stage 7.3.2.

### Mission control
- Project and Workstream summary numbers are clickable.
- Task-related counts open the correctly filtered task list.
- Entity counts jump directly to their relevant section.

### Tasks and calls
- Task titles in the main task list open the Task detail page rather than Edit.
- Added a Call List using the existing `TaskType.CALL` model.
- Call tasks show the linked Contact phone first, then Company phone as a fallback.
- Added Task filters for Type and Due state.
- Summary cards for Open, New, Doing now, Overdue, Today, Waiting, and Calls are clickable.

### Task to Want / Offer linking
- Want and Offer attachment panels are collapsed by default.
- Existing links are visible while collapsed.
- Ranked suggestions and search are fetched only after the user expands the panel.
- Existing server-side ownership validation remains in force on save.

### Wants and Offers
- Added sorting with Attention as the default.
- Attention prioritises overdue/due-today linked tasks, urgency, importance, review date, and recency.
- Other sort options include Urgency, Importance, Review date, Recently updated, and Title.

### Notes
- Want and Offer detail pages again use the standard voice-capable note entry pattern.
- Note history uses the shared NotesPanel.

### Unlink safety
- Removing a Want or Offer from an embedded entity panel now unlinks that association rather than deleting the Want/Offer globally.
- Contextual unlink rules preserve other valid relationships.
- Permanent deletion remains possible only through an explicit non-contextual delete operation.

### Styling
- Primary Save/Create buttons in the affected shared/new panels use the normal Relish teal/green primary styling.

## No database migration

Stage 7.3.3 does not modify the Prisma schema or migration history.

`npx prisma migrate dev` should therefore report no new migration to apply after the existing Stage 7.3.2 database is current.

## Deferred intentionally

### Stage 7.3.4 - Commercial values
- Move commercial monetary storage to a safe wide type.
- Support values up to at least $100 trillion.
- Use `$m` as the user-entry convention across Wants, Offers and Deals.
- Audit conversion paths and formatting.

### Stage 7.3.5 - Recurring tasks
- One open occurrence per recurring series.
- Missed occurrences remain overdue rather than creating duplicates.
- Completion advances to the next future anchored recurrence date.
- Preserve completed history and entity links.

## Suggested test order

1. Open a Project and a Workstream and click each summary number.
2. Open the main Tasks page and click a task title. Confirm it opens Task detail, not Edit.
3. Create or edit a CALL task with a linked Contact phone and open the Call List.
4. Edit a Task with a Want/Offer link. Confirm the panel is collapsed, shows the existing link, and only loads suggestions after expansion.
5. Open Wants and Offers and test Attention, Urgency, Importance, Review date and Recently updated sorting.
6. Add a voice note to a Want and an Offer, save, and confirm the note appears in history.
7. From a Company or other embedded panel, remove a Want/Offer and confirm it disappears from that entity but remains in `/wants` or `/offers`.
8. Confirm primary Save buttons use the standard Relish teal/green styling.
