# Stage 8.9 - Install and Test

## Deploy

Use the supported Node 22 runtime and the intended environment database.

```bash
# Install locked dependencies and regenerate Prisma Client.
npm install

# Apply the additive Stage 8.9 migration.
npm run migrate:deploy

# Run the focused Stage 8.9 boundary regression.
npm run check:stage8.9

# Run the prior roadmap and Lead regressions.
npm run check:stage8.8.14
npm run check:stage8.8.12
```

Do not reset the database and do not run `prisma migrate dev` against production.

## Manual acceptance

1. Sign in and confirm existing Contacts, Leads, Deals, Wants, Offers, and other Business data remain available.
2. Open `/settings/context-spaces` and confirm the existing default space is labelled Business.
3. Create the Dating space through the provided action.
4. Confirm `/dating` reports that the isolated space is ready.
5. Confirm Dating displays no Business counts or records.
6. Confirm the Dating navigation does not show Business Contacts, Leads, Deals, or other Business modules.
7. Select `Switch to Business`, confirm the application label changes to Business, and confirm the Business records are unchanged.
8. Confirm an invalid or another owner's ContextSpace cookie is ignored and replaced by server-side resolution.
9. Confirm a Business-only agent cannot start or execute tools in the Dating ContextSpace.
10. Create a controlled sensitive test run and confirm ordinary audit JSON contains redaction metadata rather than the test transcript.

## Rollback considerations

The migration adds fields and indexes used by Stage 8.9 runtime code. Roll back application code and database migration together only through an explicitly reviewed recovery plan. Do not remove ContextSpaces or contextual records.
