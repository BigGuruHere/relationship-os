# Stage 8.14.3.1 - Svelte const placement hotfix

## Problem

`src/routes/general/people/[id]/+page.svelte` placed an `{@const}` tag inside the `<article>` rendered by an `{#each}` block.

Svelte requires `{@const}` to be an immediate child of a supported control-flow block such as `{#each}`.

## Fix

The review lookup now occurs immediately inside the `{#each}` block before the `<article>` element.

No runtime behaviour, custody logic, Living Understanding logic, or database schema changed.

## Migration

None.
