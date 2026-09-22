# Stage 8.8.12 - Lead Filter Authoritative Refresh

## Outcome

The Lead filter interaction now uses a full document navigation when filters are applied. This guarantees that the displayed Lead list is rebuilt from the submitted query by the server rather than relying on same-route client state.

## Changes

- Applying filters immediately loads the filtered Lead list.
- The filter section returns collapsed after the new page loads.
- Applied-filter state is recalculated from the latest server page data.
- **Pin current filter** appears after a real filter has been applied.
- **Clear filters** appears beside Pin for an applied filter and returns to the default `/leads` list in one click.
- Clearing filters resets all visible filter controls to their default values through the fresh unfiltered page load.

## Data impact

Code-only release. No Prisma schema change and no database migration.
