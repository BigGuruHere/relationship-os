# Stage 8.8.9 - Install and Test

Stage 8.8.9 is code-only. It adds Leads and Lead Notes to the main Search page and does not add a Prisma migration.

## Install

Replace the current source with the Stage 8.8.9 package, then from the project directory run:

```bash
npm install
npx prisma validate
npx prisma migrate status
npx prisma generate
```

If Stage 8.8.8 was already fully installed, `npx prisma migrate status` should report that the database is up to date. Do not create a new migration for Stage 8.8.9.

## Focused checks

```bash
npm run check:stage8.8.9
```

You can also rerun the recent workflow checks:

```bash
npm run check:stage8.8.7
npm run check:stage8.8.8
npm run check:stage8.8.9
```

Then run the normal project checks:

```bash
npm test
npm run check
```

## GUI smoke test

Start Relish:

```bash
npm run dev
```

Then test the main Search page.

1. Open **Search** from the main menu.
2. Confirm **Leads** appears in the scope dropdown.
3. With scope **All**, search part of a Lead name, such as part of a company/person name. Confirm the Lead appears and opens correctly.
4. Search a phrase stored in the Lead's Description, Notes or Next Action. Confirm the Lead appears.
5. Add a distinctive phrase to a time-stamped Lead Note, for example `TEST SEARCH BLUE WOMBAT`, then search `blue wombat`. Confirm the Lead appears under **All** or **Leads**.
6. Change the scope to **Notes** and search the same phrase. Confirm the matching **Lead note** appears and links to the correct Lead.
7. Search an existing Contact/Company/Deal to confirm the pre-existing global search results still work.

## Expected result

The Search page should now operate across both the older CRM records and MarketLeads, including the separate notes accumulated while a Lead is being worked.
