# Stage 8.8.7 - Install and Test

Stage 8.8.7 is code-only. If Stage 8.8.6 is already installed and your database was up to date, no new migration should appear.

## 1. Replace / update the source

Use the Stage 8.8.7 package as the new source tree, preserving your normal `.env` / local environment setup.

## 2. Install and regenerate

On macOS / zsh:

```bash
npm install
npx prisma generate
npx prisma validate
npx prisma migrate status
```

`migrate status` should report the database schema is up to date if 8.8.6 had already been fully installed.

## 3. Focused regression test

```bash
npm run check:stage8.8.7
```

Then run the prior calling-workflow checks:

```bash
npm run check:stage8.8.1
npm run check:stage8.8.2
npm run check:stage8.8.3
npm run check:stage8.8.4
npm run check:stage8.8.5
npm run check:stage8.8.6
```

## 4. Full application checks

```bash
npm test
npm run check
npm run dev
```

## 5. GUI checks

### Company identity

1. Open Companies -> New company.
2. Confirm the External identifier area is optional.
3. Create a Company with only a name and confirm it succeeds.
4. Create / test a Company with an ABN or ACN.
5. Try the same identifier again and confirm Relish blocks the duplicate and points to the existing Company.
6. Try `ABC Training` when `ABC Training Pty Ltd` exists and confirm this is only a possible-duplicate warning, with `Create anyway` still available.
7. Open an existing Company and add/remove an external identifier from the External identifiers panel.

### Lead working filter

1. Open Leads and confirm Filters starts collapsed.
2. Expand Filters and apply a Batch / Source / Status combination.
3. Confirm the applied criteria appear in the collapsed filter header.
4. Click `Pin current filter`.
5. Confirm the pinned working-list card appears above Filters.
6. Navigate elsewhere and return to Leads, then use `Open` on the pin.
7. Confirm the exact filter is restored and the lead list is freshly sorted.
8. Click `Unpin` and confirm the card disappears.
