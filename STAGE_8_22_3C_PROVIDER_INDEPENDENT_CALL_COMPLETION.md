# Relish Stage 8.22.3c - Provider-Independent Call Completion and Continuity

## Objective

A verified post-call event proves that the voice call has ended. It does **not** prove that Relish's transcript ingestion or Living Understanding (LU) processing is complete. Relish owns both the call ledger and the continuity gate. No ElevenLabs API-status GET is needed during call initiation.

This stage builds directly on **Stage 8.22.3b** and retains the Stage 8.22 consent/SMS and ContextSpace fixes.

## Lifecycle

1. **STARTED**: The initiation webhook creates `DorianVoiceCallLifecycle`. A normal, provisional caller acquires their existing atomic phone gate. A processing-only call is recorded separately and acquires no new gate.
2. **ENDED**: A verified post-call transcription event (or a signed call-initiation-failure event) enters `recordVerifiedVoiceCallEnded()`, a provider-neutral Relish core operation. It records `callState=ENDED`, with the best available signed end time. No second request to ElevenLabs occurs.
3. **AWAITING_INGEST**: The legacy `NetworkPhoneCaller` compatibility gate changes from `IN_CALL` to `AWAITING_INGEST`. This is deliberately **not** yet eligible for worker processing. It prevents the worker reading a transcript that the webhook has not committed.
4. **PROCESSING / WORKING**: After the transcript and participant source are committed under the correct custody, the webhook queues understanding and permits the worker to claim it. The worker marks LU `PROCESSING` only after it claims the work.
5. **READY**: A successful LU job releases the phone gate immediately. Empty calls, consent-refused calls, unresolved participant sessions and other cases with no eligible LU job also release their matching gate without pretending LU was completed.
6. **Ten-minute timeout**: If a *confirmed-ended* call's LU remains unfinished, the gate is released ten minutes after the **recorded call end**, not call initiation or webhook arrival. A running worker can finish later, but its completion can never release a subsequent call's lock.

`DorianVoiceCallLifecycle` is the authority for provider call completion. `NetworkPhoneCaller` remains an atomic compatibility gate, not a second authority for whether a physical call has ended.

## Missing completion events

A missing post-call event provides no trustworthy call end time. This stage **does not** invent one or start the ten-minute clock based on initiation time.

To prevent permanent denial of access, it introduces a separate conservative **two-hour unconfirmed active-call safety lease**. If no signed completion is ever recorded, a subsequent initiation or an active phone worker can release the stale compatibility gate after two hours from its start. The ledger becomes `UNCONFIRMED`, with `endedAt` still null, and the log gives reason `MISSING_COMPLETION_EVENT`.

This is an exception policy, **not** the normal ten-minute completion rule. It is a safety tradeoff: without authenticated completion, Relish cannot know whether an unusually long call is still physically active. To improve this later without binding the core to ElevenLabs, send a separately authenticated hang-up event from the telephony layer through a provider adapter. Missing completion events should be investigated rather than routinely allowed to reach this two-hour threshold.

## Files changed

- `src/lib/server/core/voiceCallEvents.ts` - new generic verified call-end entry point.
- `src/lib/server/core/dorianVoiceCallLifecycle.ts` - provider-neutral ID validation, terminal call closure and pending-LU state with no status polling.
- `src/lib/server/core/phoneContinuityPolicy.mjs` - pure continuity decisions and the explicit two-hour unconfirmed safety lease.
- `src/lib/server/core/phoneUnderstandingAutomation.ts` - local-only ledger reconciliation, staged ingestion, ten-minute completion expiry, safe late-event checks.
- `src/lib/server/integrations/elevenlabs/phoneOnboarding.ts` - no provider API GET; better wait reason logs, participant call ledger association.
- `src/routes/api/webhooks/elevenlabs/initiation/+server.ts` - stable caller-ledger association.
- `src/routes/api/webhooks/elevenlabs/+server.ts` - authenticated provider events mapped immediately to Relish call completion, independent of transcript and LU.
- `scripts/process-stage8-15-4-7f-2-phone-queue.ts` - worker starts only after transcript ingestion; local-only stale-gate recovery.
- Existing Stage 8.22.3/3a/3b regression tests updated for the new contract; new `tests/core/stage8-22-3c-provider-independent-continuity.test.mjs` added.
- Removed unused `phoneCallCompletionPolicy.mjs`, which previously interpreted live ElevenLabs GET statuses in the continuity layer.

The signed webhook verification and ContextSpace authorisation are preserved. Neither the webhook nor the provider-neutral helper grants access to a participant's transcript without a verified Relish session.

## Database migration

**None.** This stage uses the existing Stage 8.22.3 ledger and caller columns. `AWAITING_INGEST` and `UNCONFIRMED` use pre-existing string state columns. No schema migration, data reset or acceptance reset is required.

## Installation on LOCAL

1. Replace the local Relish source with this complete source package, preserving any independent later changes.
2. Stop and restart the local Relish server and the separate phone LU worker if you run it. Both must use the updated code.
3. Run:

```powershell
# Validate SvelteKit and TypeScript in your existing local installation.
npm run check

# Run historical and new call-lifecycle regressions.
node --test tests/core/stage8-22-3-voice-call-lifecycle.test.mjs tests/core/stage8-22-3a-verified-completion-gate.test.mjs tests/core/stage8-22-3b-failed-provider-call.test.mjs tests/core/stage8-22-3c-provider-independent-continuity.test.mjs

# Restart the application after stopping the existing server.
npm run dev
```

`npm ci` and `prisma generate` are not required for these source-only changes if your dependencies and previously generated Stage 8.22.3 Prisma client are already up to date. Do not run `npx prisma migrate dev` for this stage.

## Test checklist

1. **Normal call**: Call, speak, hang up. The signed webhook closes the ledger `ENDED` regardless of whether the LU worker is running. The caller briefly appears `AWAITING_INGEST`, then `PROCESSING` once ingestion commits.
2. **LU worker active**: Run the separate worker. Confirm a completed/failed LU job releases the caller gate without manual action.
3. **Rapid callback**: Call before understanding completes. The second conversation is recorded as `PROCESSING_ONLY` and closes when its own post-call event arrives. It never claims or extends the first call's gate.
4. **Empty transcript**: A verified webhook with no participant speech closes the call and releases the gate immediately. No fabricated LU-complete event.
5. **No participant session or consent**: Verified call end is still recorded, but no unattributed private transcript is imported. Release the matching gate.
6. **Late completion**: A delayed signed event must not release or replace a newer conversation's gate. Its ledger can still be closed, even after the unconfirmed lease was applied.
7. **Slow LU**: A *confirmed-ended* call blocked for over ten minutes is released on the next initiation, regardless of when the processing worker started.
8. **Missing webhook**: `STARTED` and an unconfirmed active gate are logged as distinct from `ENDED`. After the independent two-hour safety lease, the ledger is `UNCONFIRMED` and the next call is permitted, without falsely claiming a provider-confirmed end time.

## Read-only diagnostic SQL

```sql
-- Compare the independent provider call ledger to Relish's phone continuity gate.
-- Neither query changes records or requires raw participant transcript data.
SELECT "conversationId", "mode", "callState", "understandingState",
       "startedAt", "endedAt"
FROM "DorianVoiceCallLifecycle"
ORDER BY "startedAt" DESC
LIMIT 20;

SELECT "id", "understandingState", "understandingConversationId",
       "understandingCallEndedAt", "understandingStateAt"
FROM "NetworkPhoneCaller"
WHERE "understandingState" <> 'READY'
ORDER BY "understandingStateAt" DESC;
```

## Verification and remaining scope

**26 targeted tests passed locally in this delivery environment**, including pure time-policy assertions and source wiring checks. These are not live provider/database integration tests. This environment did not have the project's npm dependencies installed, so `npm run check` was **not** executed here; run it locally before a real call.

This stage addresses the **telephone** continuity gate. The earlier browser QR pilot queue has its own understanding outcome rules and is not consolidated into the telephone gate in this stage. The long-term design can further unify all channel sessions under one provider-neutral lifecycle and use an independent durable LU job queue so jobs not claimed before timeout can still be processed safely. Existing completed/failed LU workers continue after a gate timeout, but this stage does not automatically restart a not-yet-claimed LU job after its gate expires.

Historical stuck records are not modified by installation. If a previous call has a confirmed `ENDED` ledger, the next initiation repairs and evaluates it locally. Records with no completion evidence are subject to the separate unconfirmed safety lease, not the ten-minute completed-call window.
