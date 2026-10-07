# Stage 8.12.13.8.2.1 - Svelte const placement hotfix

This hotfix fixes a Svelte compile error in the multi-step longitudinal chaining page.

## Cause

Stage 8.12.13.8.2 placed an `{@const}` tag directly inside a DOM `<section>`. Svelte only permits `{@const}` as the immediate child of supported control-flow blocks, snippets, fragments, boundaries, or components.

## Fix

The derived later-source list is now calculated by `remainingLongitudinalSources()` in the component script and referenced from the markup. No experiment behavior, database schema, persistence behavior, or AI prompt behavior has changed.

## Validation performed

- TypeScript server syntax checks passed.
- Policy module syntax check passed.
- Source assertion confirms the invalid `{@const}` placement is gone.
- All 30 `.test.mjs` files passed with Node type stripping.
