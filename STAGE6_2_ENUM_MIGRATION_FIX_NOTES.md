# Stage 6.2 Enum Migration Fix

This package replaces the original single Stage 6.2 migration with two migrations:

1. `20260818100000_stage6_2_task_focus_new_enum`
   - Adds `NEW` to the `TaskFocus` enum.
2. `20260818101000_stage6_2_task_filters_sort`
   - Sets `Task.focus` default to `NEW`.

This avoids the PostgreSQL error:

`unsafe use of new value "NEW" of enum type "TaskFocus"`

PostgreSQL requires the enum value addition to be committed before the value is used as a column default.

If you previously extracted the failed package, delete this old folder before running Prisma again:

`prisma/migrations/20260818100000_stage6_2_task_filters_sort`

Then run:

```bash
npx prisma generate
npx prisma migrate dev
npm run check
npm run build
npm run dev
```
