# Relish Stage 8.22.4 - Call Initiation Reliability and Continuity Fix

**Baseline:** Complete Relish Stage 8.22.3c source. **Date:** 31 October 2026.  
**Prisma migration:** **NO**. All changes use existing database tables and statuses.  
**Deployment:** Relish application only. The managed Proxy 8.21.8 may remain unchanged; ensure it routes initiation and completion to the same intended Relish environment.

## Incident being addressed

The failed provider conversation `conv_6701m68szbkafmw9skr8nha8qref` reported `Missing required dynamic variables in tools: {'relish_network_session'}`. Relish's intended successful response included a session credential, but the response appeared late in the logs. Stage 8.22 had introduced a synchronous Telnyx SMS send during initiation (with a possible 12-second network timeout); Agent Management configuration refresh could also block the response. The earlier implementation additionally claimed `NetworkPhoneCaller.IN_CALL` before the conversation connected, leaving the caller blocked after an unsuccessful initiation.

These are verified source-level hazards. They do **not** establish exactly what the live ElevenLabs runtime received. The first real call is necessary to determine whether the delivery/timeout issue has been resolved.

## Design and implementation

1. **No LU lock at initiation.** `startProvisionalPhoneCall` creates a unique participant session credential but does not move the caller to `IN_CALL`. A failed initiation remains a provider *attempt* and cannot hold the understanding gate. Legacy pre-connection `IN_CALL` rows without a confirmed end time are cleared on the next provisional phone admission, without inventing a completion event.
2. **Hold only while genuine completed-call understanding is pending.** The signed completion webhook still closes `DorianVoiceCallLifecycle` independently. Following committed participant evidence, `beginPhoneUnderstanding` verifies `ENDED`, a valid participant session and a `PENDING` LU outcome before claiming `PROCESSING` for the caller. The existing worker processes the job and releases the lock on completion/failure. The ten-minute expiry is measured from the signed call-end time, never initiation time. Completed calls queued while another LU job holds the gate are picked up in chronological order by the worker.
3. **No remote Agent Management fetch on initiation.** Voice and browser initiation read a previously authenticated local `DorianAgentConfigSnapshot`. The separate `sync:dorian-config:dev` command and 60-second background worker refresh fetch published configuration out of band. A new agent with no validated snapshot fails explicitly until the sync is run; no invented persona or cross-agent fallback is allowed.
4. **No synchronous Telnyx send on initiation.** Relish creates a durable policy-SMS outbox entry (`QUEUED`) using the existing `RelishPolicySmsDispatch` table. Delivery occurs through a nonblocking local kick, the existing automatic LU worker, or the separate SMS worker. Failed/stale `SENDING` tasks may retry after five minutes. Policy instructions truthfully say the message is being arranged, not that it was delivered. Explicit consent remains required and verified independently.
5. **Validated ElevenLabs session contract.** The provider-facing response is validated before sending for `PARTICIPANT`, `BROWSER`, `PROCESSING_ONLY` and `UNRESOLVED` modes. Participant calls must have an actual session token; nonparticipants receive only the appropriate noncredential sentinel. Required compatibility variables are guaranteed as strings without changing custody or permissions. Diagnostics report boolean credential presence, scalar-variable validation and elapsed request time, **never a real session token**.
6. **Honest operator display.** `STARTED` is now described as an attempted initiation, not confirmation that a physical phone call connected.

## Files most relevant to the correction

- `src/routes/api/webhooks/elevenlabs/initiation/+server.ts` - initiation response contract, phase timings, policy outbox and snapshot-only configuration.
- `src/lib/server/integrations/elevenlabs/voiceInitiationContract.mjs` - executable response schema and safe compatibility defaults.
- `src/lib/server/integrations/elevenlabs/phoneOnboarding.ts` - admission without premature continuity lock.
- `src/lib/server/core/phoneAdmissionPolicy.mjs` - restrict holds to pending ingestion or LU work.
- `src/lib/server/core/phoneUnderstandingAutomation.ts` - acquire the processing gate from a verified completed call and prevent duplicate reclaims.
- `src/lib/server/integrations/elevenlabs/dorianControlPlane.ts` - validated local snapshots and out-of-band refresh.
- `src/lib/server/core/relishPolicySms.ts` - policy SMS outbox creation, dispatch, retry and consent/opt-out checks.
- `src/lib/server/core/nonblockingAfterResponse.mjs` - no awaited external SMS work during initiation.
- `scripts/process-stage8-22-4-policy-sms.ts` - standalone SMS worker, useful if automatic LU isn't running.
- `scripts/sync-stage8-22-4-dorian-config.ts` - initial and manual published snapshot refresh.
- `scripts/process-stage8-15-4-7f-2-phone-queue.ts` - LU queue ordering, asynchronous SMS retry and snapshot refresh.
- `src/routes/general/admin/dorian-conversations/+page.svelte` - attempt/connection terminology.
- `tests/core/stage8-22-4-call-initiation-reliability.test.mjs` - new executable contract/admission/nonblocking tests.

## Local installation

Update your local RelationshipOS files with the **complete source ZIP** (preserve any newer changes made independently). No new Prisma migration is needed; Stage 8.22.3 migration must already be installed.

```powershell
# Confirm the project is valid with your installed dependencies.
npm run check

# Run all Stage 8.22.3 and 8.22.4 lifecycle checks.
npm run check:stage8.22.4

# Synchronise the actual published Dorian persona for the LOCAL environment.
# RELISH_CONTROL_PLANE_ENV should be local when testing locally.
npm run sync:dorian-config:dev

# Start the local app.
npm run dev
```

If `RELISH_PHONE_AUTO_LU=YES`, start the existing separate LU worker in another terminal (or make sure your Railway worker deployment is running):

```powershell
# Processes completed-call understanding, plus async SMS and config maintenance.
npm run watch:stage8.15.4.7f.2:dev
```

If you are **not** running the automatic LU worker, run the standalone SMS worker instead to ensure retry and delivery after an application restart:

```powershell
# Poll the durable Terms SMS outbox independently.
npm run policy-sms:watch:dev
```

The application also tries a nonblocking SMS dispatch after preparing the initiation response. For durable processing, run a worker in every relevant deployed environment.

For Railway DEV/PROD, use the same code with that environment's values and configure the worker as an independently running process. The `:dev` script names refer to local `.env` usage and are not instructions to run LOCAL environment variables against Production. **Never apply a development `.env` file to Production.**

## Controlled first-call test

1. Stop outdated local Relish processes and confirm Proxy agent routing targets your updated LOCAL/DEV instance. Record the provider conversation ID; do not share the session token.
2. Ensure the caller is `READY` in `NetworkPhoneCaller` (a historic `IN_CALL` attempt may also be cleared automatically on admission).
3. Call **once**. In Relish initiation logs, look for `TIMING` (cached config, provisional admission, consent/outbox) and `CONTRACT` with `hasRequiredToolCredential: true`, `allVariablesScalar: true`, `mode: PARTICIPANT` and `elapsedMs`.
4. Confirm ElevenLabs connects. If it again reports a missing variable, compare the same conversation ID with the **Proxy downstream status and elapsed time**, and the active ElevenLabs tool requirements. A local `CONTRACT` log proves local response preparation, **not** that ElevenLabs received/applied it.
5. Talk briefly, explicitly accept the current terms if prompted, and hang up. Check a signed `post_call_transcription` event for the **same** conversation ID in the environment that initiated it.
6. After callback, the call ledger must say `ENDED`. If it contained consented participant speech, LU becomes `PENDING`/`PROCESSING` and the caller is briefly gated. When LU completes, the caller returns to `READY`. The continuity deadline remains ten minutes after the verified end time.
7. If the initial phone connection fails with no completion event, the ledger may remain `STARTED`, **but the caller should remain `READY`**. A fresh dial must not be blocked by that attempt.

**Read-only Neon Development verification:**

```sql
-- Check the latest phone call attempts and actual provider completion.
SELECT "conversationId", "mode", "callState", "understandingState", "startedAt", "endedAt"
FROM "DorianVoiceCallLifecycle"
ORDER BY "startedAt" DESC LIMIT 10;

-- Check the independent Relish learning gate, not physical phone connection state.
SELECT "id", "understandingState", "understandingConversationId", "understandingCallEndedAt"
FROM "NetworkPhoneCaller"
WHERE "understandingState" <> 'READY';

-- Check Terms SMS outbox without showing phone numbers or message bodies.
SELECT "policyVersion", "state", "attemptedAt", "lastErrorCode"
FROM "RelishPolicySmsDispatch"
ORDER BY "attemptedAt" DESC LIMIT 10;
```

## Validation and limitations

- **36 targeted Node tests pass**, including 10 new Stage 8.22.4 tests. The 10 include executable response-contract, sentinel and nonblocking-task tests, with supplemental source wiring assertions. Earlier stage tests also pass, with the outdated preconnection-lock assertion updated to the new design.
- Updated TypeScript files passed `node --experimental-strip-types --check` syntax checks; package JSON passed syntax validation.
- A **full `npm run check` was not completed** here because dependency installation stalled. Run it locally before testing/deploying.
- **No live ElevenLabs, Telnyx, Proxy, Neon or Railway integration test was performed** in this environment. Actual initiation latency, downstream proxy delivery, live agent tool template configuration, and audio connection success remain to be verified.
- The underlying provider-initiated call can still fail for reasons unrelated to Relish, but it should not create a durable learning lock.
- Historically missing completion webhooks still leave a `STARTED` *attempt* in the independent ledger. That status is no longer treated as proof of an active connection and does not create an understanding hold.
- The standalone SMS outbox requires a worker for guaranteed restart recovery. In-process best-effort scheduling is not a substitute for a durable worker in a serverless runtime.
- Agent configurations must be synced outside the call path, especially after publishing a new agent or changing environment.

**Prisma migration: NO.** Do not run `prisma migrate dev` merely for this stage. **No local build step required.**
