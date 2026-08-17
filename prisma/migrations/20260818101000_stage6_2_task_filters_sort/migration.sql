-- Stage 6.2 part 2: use NEW as the default task-focus bucket after the enum
-- value exists and the prior migration has committed.

ALTER TABLE "public"."Task" ALTER COLUMN "focus" SET DEFAULT 'NEW';
