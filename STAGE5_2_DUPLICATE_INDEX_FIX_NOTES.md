# Stage 5.2 Duplicate Index Fix

This follow-up migration fixes the company duplicate-name warning flow.

The previous migration changed the Prisma schema from a hard unique company name check to a soft UI warning, but the SQL attempted to remove the old company unique key using `ALTER TABLE DROP CONSTRAINT`. The original Prisma migration had created it as a unique index, so the unique index could remain in the database.

This migration explicitly drops:

```sql
DROP INDEX IF EXISTS "public"."Company_userId_nameIdx_key";
```

and ensures the normal lookup index exists:

```sql
CREATE INDEX IF NOT EXISTS "Company_userId_nameIdx_idx" ON "public"."Company"("userId", "nameIdx");
```

No application code changes are included in this patch.
