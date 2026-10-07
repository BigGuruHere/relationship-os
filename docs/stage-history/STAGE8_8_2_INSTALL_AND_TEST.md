# Stage 8.8.2 - Install and Test

Stage 8.8.2 is code-only. There is no Prisma migration.

## Install

Replace the Stage 8.8.1 source with the Stage 8.8.2 package, preserving your local `.env`.

Then run:

```bash
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run check:stage8.8.1
npm run check:stage8.8.2
npm test
npm run check
```

`prisma migrate status` should report the database is up to date. Do not create a new migration for this release.

## GUI verification

1. Open `/leads`.
2. Select a Lead Source/import batch and any other filters you normally use.
3. Open the first lead.
4. Confirm there is no separate priority control beside the title.
5. In the Details panel, confirm the existing Priority row shows `▼ number/5 ▲`.
6. Lower priority, for example 3 to 2, and confirm it autosaves.
7. Click `Return to list`.
8. Confirm the same Lead Source/search/filter state is restored.
9. Confirm the page jumps to the lead cards.
10. Confirm the changed Priority 2 lead has moved below the remaining Priority 3 leads.
11. Open another lead, use Edit Lead to change Contact Attempt, save, and confirm `Return to list` still returns to the original filtered batch.
