# Stage 8.14.5.1 - Build Health Hotfix

## Purpose

Restore the zero-error, zero-warning Svelte/TypeScript baseline after Stage 8.14.5 without changing runtime behaviour or database schema.

## Changes

- Narrow the persisted automatic Living Understanding pipeline payload into explicit view types before rendering the Dating and General impact-review pages.
- Make proposal nullability explicit before approval rendering.
- Safely handle nullable action form data when reading the manual draft checkpoint ID.
- Remove the unused `input[type="text"]` selector from the Dating and General conversation import pages.
- Add a focused regression check for the build-health fixes.

## Database

No migration. The Stage 8.14.5 migration remains unchanged.

## Local verification

Run:

```powershell
npx prisma generate
npm run check
npm run check:stage8.14.5.1
npm run check:stage8.14.5
npm run check:stage8.14.4
npm run check:migration-integrity
```

Expected target for `npm run check`: 0 errors and 0 warnings.
