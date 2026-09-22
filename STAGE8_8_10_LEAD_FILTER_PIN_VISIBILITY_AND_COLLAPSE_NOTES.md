# Stage 8.8.10 - Lead Filter Pin Visibility and Collapse

## Purpose

Finish the Lead working-list filter UX so the pin control appears only when there is an applied filter to pin, while the filter panel returns to its compact state after applying filters.

## What changed

- **Pin current filter** now remains visible in the Lead filter header at all times.
- The pin action is disabled when no server-applied filter exists.
- The pin action remains disabled when the current applied filter is already pinned.
- Submitting **Apply filters** immediately collapses the filter panel. This explicitly handles same-route GET navigation where SvelteKit may preserve local component state.
- Existing pinned-filter persistence, per-user/ContextSpace storage keying, and return-to-list behavior are unchanged.

## Database impact

None.

- No Prisma schema changes.
- No migrations.
- No encrypted-data or custody-boundary changes.

## Verification

A focused Stage 8.8.10 regression test verifies:

1. the pin control is not conditionally hidden,
2. it is disabled when no applied filter exists or the current filter is already pinned, and
3. Apply filters explicitly collapses the filter panel.
