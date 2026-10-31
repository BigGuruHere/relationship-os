# Stage 8.22.4a - Initiation Typecheck Corrections

**Project:** Relish / RelationshipOS  
**Date:** 31 October 2026  
**Base:** Stage 8.22.4 complete source  
**Scope:** Fix six `svelte-check` errors across four files without changing initiation, SMS, proxy, consent or call-processing semantics.

## Why this update

The local installation reported six errors and zero warnings:

- `phoneAdmissionPolicy.mjs`: implicit `any` for `state`.
- `nonblockingAfterResponse.mjs`: implicit `any` for `task`.
- `voiceInitiationContract.mjs`: implicit `any` for `payload` (twice) and `mode`.
- `initiation/+server.ts`: `.trim()` called on a property that TypeScript inferred as `never`.

The last error was real: `startProvisionalPhoneCall()` returns only `{status:'WAIT', reason}` for blocked calls. The WAIT branch does not include a `preferredName` field. It cannot safely produce a personalised waiting greeting.

## Exact changes

1. `src/lib/server/core/phoneAdmissionPolicy.mjs` - explicit JSDoc input and return types for `continuityHoldReason`, preserving existing gate policy.
2. `src/lib/server/core/nonblockingAfterResponse.mjs` - typed asynchronous callback and error callback. It retains `setImmediate` and does not delay initiation.
3. `src/lib/server/integrations/elevenlabs/voiceInitiationContract.mjs` - JSDoc mode union, `unknown` untrusted payloads, runtime envelope validation and a record type for scalar variable checking. Required `relish_network_session` validation remains enforced.
4. `src/routes/api/webhooks/elevenlabs/initiation/+server.ts` - blocked calls use a generic 'Hi there' greeting and empty `user_name`; the original code attempted to read `prepared.preferredName` from a WAIT result with no such property. Session issuance and gate decisions are untouched.
5. `tests/core/stage8-22-4-call-initiation-reliability.test.mjs` - added regression assertion for WAIT-branch handling.

## Installation (local development)

Copy the files from the complete source ZIP into your existing Relish source, retaining any independent newer changes. Stop the running server, then:

```powershell
# Verify SvelteKit and TypeScript against your installed dependencies.
npm run check

# Run the Stage 8.22.4 lifecycle and initiation regression suite.
npm run check:stage8.22.4

# Start the updated Relish application only after both checks pass.
npm run dev
```

**Prisma migration required: No.** No schema, migration, lockfile or database changes.

`npm ci` and `prisma generate` are not required just for these source corrections, assuming the previously installed dependencies and generated Prisma client are intact.

## Validation in the delivery environment

- Standalone `tsc --checkJs --noEmit` of the three corrected `.mjs` helpers, with Node declarations: **passed**.
- Stage 8.22.4 Node lifecycle and contract suite: **37 tests passed**, including the new WAIT-branch regression.
- Full `npm run check` and a live ElevenLabs initiation: **not executed here**, because this delivery environment does not have the application's full installed SvelteKit dependencies. Run locally.

## Separate configuration warning

Your sync command reported `Management unavailable; using verified local revision 1` followed by `Synced 1 active agent configuration snapshots`. That is a local, previously validated configuration fallback, **not proof that Agent Management was reached and a new revision fetched**. It does not account for the six TypeScript errors. Investigate Agent Management connectivity separately if the latest published prompts are required for your next call.

## First call test once `npm run check` passes

Check for the `[ElevenLabs][...][CONTRACT]` response log with `mode: PARTICIPANT`, `hasRequiredToolCredential: true`, and `elapsedMs`. This records what Relish prepared; final provider acceptance and connection must still be confirmed in ElevenLabs/Proxy logs. If it fails, capture the exact provider failure and matching `conversationId` before resetting state.
