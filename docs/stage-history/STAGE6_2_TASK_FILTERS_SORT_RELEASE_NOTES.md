# Stage 6.2 - Task Filters and Sorting

This release improves the task inbox so tasks can be filtered and sorted as a working action list.

## Added

- Task focus now includes `New`.
- New tasks default to `New` instead of `Not doing now`.
- Task focus order is now:
  1. New
  2. Doing now
  3. Not doing now
  4. Never doing now
- Main task inbox filters:
  - Status
  - Focus
  - Project
  - Lead
  - Person/contact
  - Company
  - Deal
  - Search query
- Main task inbox sorting:
  - Focus order
  - Due date - soonest
  - Due date - latest
  - Urgency
  - Importance
  - Recently updated
  - Recently created
  - Title A-Z
  - Project A-Z
  - Lead A-Z
- Quick status/focus updates preserve the current task filters and sort after changing a task.

## Migration

New migration:

```text
20260818100000_stage6_2_task_filters_sort
```

This migration adds the `NEW` enum value to `TaskFocus` and sets the Task focus default to `NEW`.

## Suggested tests

1. Create a new task without manually choosing focus.
2. Confirm its focus is `New`.
3. Open `/tasks` and sort by `Focus order`.
4. Confirm order is New, Doing now, Not doing now, Never doing now.
5. Filter tasks by a project.
6. Filter tasks by a lead.
7. Filter by focus.
8. Sort by due date, urgency, recently updated, title, project, and lead.
9. Change a task focus from the list and confirm the filters stay applied.
