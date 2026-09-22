# Stage 8.8.10 - Install and Test

## Install

This is a code-only release. No database migration is required.

```bash
npm install
npx prisma generate
```

## Focused test

```bash
node --experimental-strip-types --test tests/core/stage8-8-10-lead-filter-pin-collapse.test.ts
```

## Recommended regression checks

```bash
npm run check:stage8.8.7
npm run check:stage8.8.8
npm run check:stage8.8.9
npm run check
```

## Manual verification

1. Open `/leads` with no filters applied.
2. Confirm **Pin current filter** is not shown while no filter is applied.
3. Expand **Filters**, choose a filter, then press **Apply filters**.
4. Confirm the filtered list loads with the filter panel collapsed.
5. Confirm **Pin current filter** now appears and is enabled.
6. Pin the working list and confirm the button changes to **Pinned** and becomes disabled.
7. Navigate into a Lead and use **Return to list**. Confirm the same filtered working list is restored.
