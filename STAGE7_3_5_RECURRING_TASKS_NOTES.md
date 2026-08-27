# Stage 7.3.5 - Recurring Tasks

## Purpose
Add simple recurring Tasks without creating a separate scheduling system.

## Behaviour
- A recurring Task requires a Due date.
- Supported schedules: Daily, Weekly, Fortnightly, Monthly.
- Only one outstanding occurrence exists at a time.
- If the current occurrence is not completed, it remains overdue. No duplicate occurrence is created.
- When an occurrence is completed, Relish creates the next scheduled occurrence.
- The schedule stays anchored to the original due date, so late completion does not move the cadence.
- If completion is late and one or more scheduled dates have already passed, Relish advances to the next future scheduled date.
- Monthly schedules calculate each occurrence from the original anchor, preserving dates such as January 31 -> February 28 -> March 31.
- Completing a recurring Task from the Task list, Task detail page, or Task edit page uses the same recurrence engine.
- Setting Repeat to Never stops the whole active series. Any already-created future occurrence is kept as a normal one-off Task rather than deleted.
- Existing non-recurring Tasks are untouched by the migration.

## Schema
Added to Task:
- recurrenceRule: TaskRecurrenceRule?
- recurrenceSeriesId: String?
- recurrenceAnchorAt: DateTime?

Added index:
- userId + recurrenceSeriesId + status

## Migration
`20260827110000_stage7_3_5_recurring_tasks`

Use the normal development workflow:

```bash
# Apply the new development migration and regenerate Prisma Client.
npx prisma migrate dev
```

Then restart the development server if it was running.

## Test order
1. Create a normal Task and confirm it behaves exactly as before.
2. Create a Task with Due tomorrow and Repeat = Weekly.
3. Confirm the Task shows the recurring indicator and the Repeat setting on edit.
4. Leave it incomplete past the due date and confirm no second Task appears.
5. Mark it Done and confirm exactly one new Task is created for the next weekly date.
6. Complete the next occurrence late and confirm the following date remains anchored to the original schedule.
7. Test Fortnightly and Monthly.
8. For Monthly, test an anchor such as January 31 and confirm February is clamped to February 28/29 and the following month returns to the 31st where possible.
9. Edit a recurring Task and choose Never. Confirm the active series stops and any existing future occurrence becomes a normal one-off Task.
10. Submit Done twice or refresh/re-submit and confirm no duplicate next occurrence is created.
11. Confirm linked Contact, Company, Deal, Project, Workstream, Want, Offer and other Task context is carried to the next occurrence.
12. Confirm existing Tasks with no recurrence remain unchanged.
