# Stage 8.12.13.1 - Supersession chronology UX fix

This is a targeted patch on top of the complete Stage 8.12.13 Conversation Import source. No schema or migration changes. The transcript workflow is unchanged.

## What changed

- Current active knowledge now exposes the original claim `createdAt`, separate from `updatedAt`.
- The comparison page displays the dates when each statement was entered into Relish.
- When the selected replacement predates the other statement, the page disables the supersession choice, explains why, and offers **Swap statements**. All non-retirement comparison choices remain available.
- Server-side chronological validation remains mandatory. Its error is now more actionable.
- Three permanent regression checks cover the date contract, server guard and UI guard.

## Important distinction

The implementation uses **claim entry time**. It does not yet model the actual effective date of someone's change in circumstances. An older recorded statement could reflect a later real-world change, or a retrospective entry could concern an earlier one. Such cases need a future evidence-backed effective-date workflow. Do not bypass the server guard just to force retirement.

## Verification

- `node --experimental-strip-types --test tests/core/*.test.mjs`: 106 pass, 0 fail in packaging environment using Node 22.16.0.
- The standard `npm test`, Svelte/TypeScript check, build, live DB checks and browser acceptance were not performed here because dependencies were not installed. Perform these on a development environment before deployment.

## Install on Mac

1. Back up your existing source and any uncommitted local changes. Unzip this full source into a separate folder first and compare it with your working copy.
2. Preserve your `.env` and any local uploads. This ZIP does not include your credentials or production data.
3. On the development machine, from the project directory:

```bash
npm ci
npx prisma validate
npx prisma generate
npm test
npm run check
npm run build
npm run dev
```

4. Open Dating -> People -> Living Understanding -> Compare new knowledge with earlier understanding. Select a later-entered statement as the replacement, then an earlier-entered statement sharing a topic. Choose supersedes, acknowledge and submit. Test the reverse ordering as well, confirm it is blocked with a swap button, and confirm the old claim's evidence remains in history. Use only your designated development database for database integration tests. No migration is required.
