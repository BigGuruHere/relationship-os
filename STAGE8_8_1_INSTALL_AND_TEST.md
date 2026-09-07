# Stage 8.8.1 - Install and test

This is a code-only usability release. There is no Prisma migration.

## Install

Replace the current Stage 8.8 v2 source with the Stage 8.8.1 package, preserving your local `.env`.

Because `schema.prisma` is unchanged, no database migration is required. If this is a fresh checkout/computer, run `npm install` and `npx prisma generate` as usual.

## Focused verification

```bash
npm run check:stage8.8.1
```

Then run the normal project checks:

```bash
npm test
npm run check
```

## GUI verification

1. Open a lead with priority 3.
2. Click the down arrow beside Priority.
3. Confirm it changes to 2/5 and briefly shows `Saved`.
4. Open Edit lead and confirm the Priority field is also 2.
5. Return to the filtered Leads list and confirm the lead sits below remaining priority-3 leads.
6. Reopen it, raise priority again, and confirm the same behaviour.
7. Confirm the arrows disable at priorities 1 and 5.

The Contact Attempt dropdown should behave exactly as before.
