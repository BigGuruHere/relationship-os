# Stage 8.15.4.7f.3a - Last-Call Summary and LU Continuity

## Purpose

Add recent-conversation continuity for provisional telephone callers without replacing or changing the authoritative Living Understanding retrieval implemented in Stage 8.15.4.7f.3.

## Implementation

- In `src/lib/server/integrations/elevenlabs/phoneOnboarding.ts`, after resolving the correct provisional caller, query the most recent imported Interaction belonging to the caller's `userId`, `contextSpaceId`, and `contactId`, using `PERSON_CONVERSATION_SOURCE_CHANNEL`, and having a non-null encrypted summary.
- Run the query inside the caller's workspace custody and order by `occurredAt` and `createdAt` descending.
- Decrypt using the existing `decryptInteractionSummary` helper (including its legacy AAD fallback).
- Trim and bound the resulting text to 1,600 characters and supply it as `last_call_summary` in the ElevenLabs initiation dynamic variables.
- Leave `memory_and_identity_context`, `relish_living_understanding`, and `relish_living_understanding_revision` unchanged.
- A caller with no imported summary receives an empty `last_call_summary`. This does not create a new summary or independent memory record.
- A failed custody/database query returns the existing `WAIT` path rather than bypassing caller isolation.

## What this does not do

- Does not generate a fresh summary or structured open-thread list.
- Does not read a different participant's conversation evidence.
- Does not alter automatic Living Understanding approvals, worker scheduling, or account verification.
- Does not solve missing-webhook recovery.
- Does not include any Prisma schema or migration changes.

## Installation

1. Back up or commit the current Relish checkout.
2. Extract the overlay files into `C:\Users\teren\Coding\RelationshipOS`, preserving `.env` and local changes.
3. Run the tests from the project root:

```powershell
# Stage 8.15.4.7f.3a regression checks.
node --test tests/core/stage8-15-4-7f-3a-last-call-summary.test.mjs tests/core/stage8-15-4-7f-3-next-call-context.test.mjs

# SvelteKit and TypeScript checks.
npm run check

# Start local app (no local production build).
npm run dev -- --port 8080
```

**Migration required:** No.

## Telephone acceptance test

1. Ensure the local server, ngrok/proxy route, and development worker are correctly configured. Previous conversation should be imported and finished processing.
2. Call from a number with an existing completed conversation that has a stored summary.
3. In ElevenLabs, confirm the initiation variable `last_call_summary` is populated, without copying tokens or private context to logs.
4. Ask Dorian about the subject of the most recent conversation. Verify that it can reference that conversation naturally, alongside long-term Living Understanding.
5. Call from a different provisional number and verify it does not receive the first caller's summary.
6. Try a new caller with no earlier imported conversation and verify it receives a blank summary.

## Validation performed

Seven source-level regression tests passed (four existing Stage 8.15.4.7f.3 tests, three new tests). Full `npm run check`, real PostgreSQL data, and live ElevenLabs integration remain unverified in this container.

## Source baseline warning

This overlay modifies only `phoneOnboarding.ts` and adds its targeted test and this document. It is based on the last available Stage 8.15.4.7f.3 source and cannot account for newer edits to `phoneOnboarding.ts` made solely in your local checkout. Compare local differences before overwriting that file.
