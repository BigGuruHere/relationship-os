# Stage 8.8.11 - Lead Filter Refresh and Reset

## Outcome

The Lead working list now refreshes immediately when filters are applied, without requiring a manual browser refresh. When at least one server-applied filter is active, a `Reset filters` button is displayed alongside the active filter summary and pin control.

## Changes

- Replaced passive GET-form navigation with an explicit SvelteKit navigation that invalidates and reloads page data.
- Kept the filter panel collapse behavior after Apply.
- Added a one-click `Reset filters` action that returns to `/leads` and immediately restores the unfiltered working list.
- Synchronized the visible filter controls with the server-applied URL when SvelteKit reuses the page component.
- Kept `Pin current filter` hidden unless a real filter is active.

## Data and architecture

- No Prisma schema change.
- No database migration.
- No custody, encryption, ContextSpace, or pinned-filter storage changes.
