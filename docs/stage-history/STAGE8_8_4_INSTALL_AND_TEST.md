# Stage 8.8.4 - Install and Test

## 1. Replace the source

Use the Stage 8.8.4 package as the complete source tree.

Keep your existing `.env` file.

Because Stage 8.8.3 had not yet been installed when this package was requested, install 8.8.4 directly instead of installing 8.8.3 first.

## 2. Validate migration state

Run:

```bash
npx prisma validate
npx prisma migrate status
```

If Stage 8.8.3 has not yet been installed, the expected pending migration is:

```text
20260907133500_stage8_8_3_import_batch_filtering
```

Stage 8.8.4 itself has no additional migration.

If Prisma reports unexpected drift, asks for a reset, or lists an unknown migration, stop before changing the database.

## 3. Apply the pending Stage 8.8.3 migration if required

Use the repository safety wrapper:

```bash
npm run migrate:dev
```

If `migrate status` already says the database is up to date, do not create another migration.

## 4. Generate Prisma Client

```bash
npx prisma generate
```

## 5. Verify the focused workflow tests

```bash
npm run check:stage8.8.1
npm run check:stage8.8.2
npm run check:stage8.8.3
npm run check:stage8.8.4
```

Then run the broader application checks:

```bash
npm test
npm run check
```

## 6. GUI acceptance check

Start Relish:

```bash
npm run dev
```

Open a lead from an imported Batch and verify the existing Details panel now allows direct changes to:

- Usual communication
- Contact attempt
- Last contacted
- Buyer status
- Seller status
- Priority
- Confidence
- Next action

For each field, confirm the value saves without opening Edit Lead.

Then:

1. change one or more quick fields;
2. open Edit Lead and confirm those fields show the newly saved values;
3. close Edit Lead;
4. add a Lead Note;
5. lower Priority if appropriate;
6. click Return to list;
7. confirm the same Batch/filter returns and the queue has refreshed around the new priority.

Also confirm identity/contact fields such as phone, email, company and LinkedIn are not directly editable from the Details panel.

## Production

After dev verification, production uses the normal migration/deploy path. If the Stage 8.8.3 migration is not yet in production it will be applied there in order:

```bash
npx prisma migrate deploy
```

Stage 8.8.4 requires no additional migration beyond that existing committed Stage 8.8.3 migration.
