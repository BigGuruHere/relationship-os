# Stage 8.12.11 - Mac install and test

**Back up the current project and its environment before replacing files.** Unzip the complete source and replace the project source while preserving your existing `.env`, secrets, uploads, and local uncommitted changes. The package intentionally has no `.env`.

From the extracted `relationship-os-development` directory (adjust path to your chosen location):

```bash
npm ci
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run check:stage8.12.11
npm test
npm run check
npm run build
npm run dev
```

There is **no new Prisma migration** in this stage. Do not reset or migrate a production database to test these UI changes. The full TypeScript suite and Svelte build require the project's pinned dependencies to be installed and an OS supported by those binaries. If `npm ci` fails on Catalina, preserve `package-lock.json` and capture the exact error rather than updating dependencies casually.

In the browser, create or revisit a personal reflection, generate/review knowledge with explicit AI consent, and save. On the Living Understanding overview, select an unassigned active statement and review suggested existing/new topics; edit the suggested name if needed. Check the source-reflection link, use the manual selector to make a second topic assignment, and confirm removal of a link doesn't delete knowledge. A meaningful mismatch or missing suggestion should be handled manually, not silently accepted.

Development DB tests are **separate** and can write disposable data. Run only after verifying development credentials, required fixture IDs and `ALLOW_DATING_DEV_DB_TEST=YES`. No DB test is required to deploy the no-migration code, but DB and browser verification are recommended before wider release.
