# Stage 8.8.8 - Install and Test

Stage 8.8.8 is a code-only fix on top of 8.8.7. It adds no Prisma migration.

## Install

Replace the current working tree with the 8.8.8 source using your normal safe update process, then from the project directory run:

```bash
npm install
npx prisma generate
npx prisma validate
npx prisma migrate status
```

If 8.8.7 was already fully installed, `migrate status` should report that the database schema is up to date.

## Focused checks

```bash
npm run check:stage8.8.7
npm run check:stage8.8.8
```

Then run the normal project checks:

```bash
npm test
npm run check
```

## GUI smoke test

1. Create or retain a Company named `Coca Cola`.
2. Try to create `Coka Cola`.
3. Confirm Relish shows **Possible duplicate company found** and offers the existing `Coca Cola` record for review.
4. Confirm **Create anyway** remains available because name similarity is advisory only.
5. Try `Cola` or `Coka` by itself and confirm Relish does not treat the short fragment as a fuzzy duplicate solely because it overlaps the longer name.
6. If testing an external identifier, confirm an exact reused ABN/ACN/register identifier remains a hard block.
