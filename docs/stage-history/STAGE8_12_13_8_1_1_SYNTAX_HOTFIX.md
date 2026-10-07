# Stage 8.12.13.8.1.1 - Revision experiment syntax hotfix

## Purpose

Fix a TypeScript syntax error introduced in Stage 8.12.13.8.1 in the longitudinal new-topic prompt construction.

## Change

`src/lib/server/datingUnderstandingRevisionExperiment.ts` was missing commas between two adjacent `systemPrompt` array entries around the new-topic longitudinal prompt. This prevented Vite/esbuild from evaluating the SSR route and caused a 500 on the revision experiment page.

The prompt entries are now separate, comma-delimited strings. No behavior, data model, permissions, persistence, or database schema has otherwise changed.

## Verification

- `node --experimental-strip-types --check src/lib/server/datingUnderstandingRevisionExperiment.ts` passed.
- All 29 `tests/core/*.test.mjs` files completed successfully with Node type stripping.
- No database migration is included.
