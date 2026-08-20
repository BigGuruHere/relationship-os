# Stage 6.9 Production Migration Order Fix

This patch fixes a production-only migration ordering issue where a locally generated sync migration:

`20260820044823_sync_company_contact_note_updated_at`

can run before the main Stage 6.9 migration:

`20260820143000_stage6_9_company_contact_relationships`

The sync migration alters `CompanyContactNote.updatedAt`, but in production the `CompanyContactNote` table did not exist yet.

## What this patch adds

A new idempotent migration:

`20260820043000_prepare_company_contact_note_for_prod_order`

It creates the `CompanyContactNote` table shell before the sync migration runs. The main Stage 6.9 migration later adds the foreign keys, indexes, and relationship columns.

## Production recovery steps

1. Apply this patch to the repo.
2. Commit and push it.
3. Mark the failed production migration as rolled back:

```bash
npx prisma migrate resolve --rolled-back 20260820044823_sync_company_contact_note_updated_at
```

Run the command against the production database, either from Railway with the production environment loaded or with `DATABASE_URL` set to the production database URL.

4. Redeploy.

No database reset is needed.
