# Stage 8.8.11 - Install and Test

```bash
# Install locked dependencies.
npm install

# Regenerate Prisma Client. This release has no migration.
npx prisma generate

# Run the focused Stage 8.8.11 regression.
npm run check:stage8.8.11

# Run the normal Svelte and TypeScript validation.
npm run check
```

Manual verification:

1. Open `/leads` and expand Filters.
2. Choose a filter and select `Apply filters`.
3. Confirm the panel collapses and the visible Lead list changes immediately.
4. Confirm `Pin current filter` and `Reset filters` appear.
5. Select `Reset filters`.
6. Confirm the unfiltered Lead list appears immediately and both applied-filter controls disappear.
