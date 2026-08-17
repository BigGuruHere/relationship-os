-- Stage 6.2 part 1: add the NEW task-focus enum value.
-- Keep this in its own migration because PostgreSQL will not allow a newly-added enum
-- value to be used as a default until the enum alteration has been committed.

ALTER TYPE "public"."TaskFocus" ADD VALUE IF NOT EXISTS 'NEW' BEFORE 'DOING_NOW';
