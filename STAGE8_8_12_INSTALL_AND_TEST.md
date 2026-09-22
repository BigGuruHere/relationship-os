# Stage 8.8.12 - Install and Test

```bash
# Install the locked dependencies.
npm install

# Regenerate Prisma Client. This release has no migration.
npx prisma generate

# Run the focused Stage 8.8.12 regression.
npm run check:stage8.8.12

# Run the normal Svelte and TypeScript checks.
npm run check
```

Manual acceptance:

1. Open `/leads` and confirm neither Pin nor Clear is visible without an applied filter.
2. Expand Filters, select a filter, and click **Apply filters**.
3. Confirm the list updates immediately and the filter panel is collapsed.
4. Confirm **Pin current filter** and **Clear filters** are both visible.
5. Click **Clear filters** and confirm the complete default Lead list and default filter controls are restored.
