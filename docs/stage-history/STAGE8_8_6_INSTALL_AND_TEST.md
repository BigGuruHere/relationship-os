# Stage 8.8.6 - Install and test

Stage 8.8.6 is code-only. It fixes the Next Action UI and adds no Prisma migration.

## Install

Replace the current source with the Stage 8.8.6 package, preserving your `.env` as usual.

Then run:

```bash
npx prisma validate
npx prisma migrate status
npx prisma generate
```

If you had already installed 8.8.5, `migrate status` should report the database is up to date. Do not create a migration for 8.8.6.

## Focused tests

```bash
npm run check:stage8.8.5
npm run check:stage8.8.6
```

Then run the normal application checks:

```bash
npm test
npm run check
npm run dev
```

## GUI verification

1. Open a lead that already has a Next Action.
2. Open the Next Action dropdown.
3. Select a different existing action.
4. Confirm it autosaves and the dropdown now displays the new value.
5. Choose `+ Create new action...`.
6. Type a new action and save it by pressing Enter or the Save button.
7. Confirm the normal dropdown returns with the newly created action selected.
8. Open another lead and confirm that custom action is available there.
9. Open Edit Lead and confirm the same existing/create-new behaviour is available.
