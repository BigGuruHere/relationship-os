# Temporary voice-note transcription diagnostics

The shared Brokerage/Contacts and My People recorder, chunk assembly, provider helper, polling and browser result application use one correlation ID per recording attempt. The existing random upload UUID is also the correlation ID; no account, Contact or context identifier is logged. The direct multipart transcription endpoint also creates/accepts a UUID correlation ID.

## Enable in Railway DEV only

1. Deploy the reviewed diagnostic code to the DEV application using the normal release process. Setting a flag on an older build will not add instrumentation. Nothing has been deployed or configured automatically.
2. In that DEV service's Variables, set `RELISH_TRANSCRIPTION_DEBUG=YES` and apply/restart as Railway requires. This is a runtime flag, not a PUBLIC/VITE variable. Do not enable the old DEBUG_AUDIO flag.
3. Reload the recorder page so its server-provided diagnostic flag refreshes. Choose either an existing Contact's recorder or My People. The shared component supports both.
4. Record one test note, Stop, and wait for the editable text. Copy the displayed **Transcription diagnostic reference** UUID before leaving the page.
5. In the DEV service's application deployment logs, filter for that UUID or `relish.transcription`. Browser metadata is forwarded to an authenticated, bounded diagnostic receiver, so it appears in Railway stdout JSON logs rather than only DevTools.
6. Return the flag to `NO` or remove it and reload the page after the investigation. Normal coarse error events remain on stderr with debugging disabled.

No new provider, model, recording constraint, chunk sequencing, retry policy or fallback was introduced. Provider credentials are neither supplied nor altered by diagnostics. A configured credential boolean does not verify authorization or identify the OpenAI project.

## Events and evidence

| Stage | Evidence |
|---|---|
| `browser.microphone_requested` | Recording attempt ID exists before permission is requested |
| `browser.record_start` | Actual recorder MIME/known codec; available sample rate and channel count |
| `browser.chunk_ready` | Blob size/MIME and elapsed recording time |
| `upload.received` / `upload.accepted` | Server received/accepted chunks; index, bytes accumulated, count, completion flag |
| `browser.record_stop` | Browser-reported wall-clock recording duration |
| `browser.upload_complete` | Finalization HTTP status, completion flag, request count, duration |
| `job.queued` / `assembly.complete` | Complete upload queued and actual assembled byte size |
| `provider.prepare` | Selected OpenAI/audio.transcriptions/whisper-1 and credentialsConfigured boolean; externalCallAttempted=false |
| `provider.request_attempted` | Fetch is about to be invoked, externalCallAttempted=true, multipart audio bytes/MIME |
| `provider.response` | HTTP status, provider x-request-id when present, elapsed time |
| `provider.result` | Trimmed response character count and emptyContent boolean; no response text |
| `job.complete` / `poll.result` | Same content length traversed background job and server polling |
| `browser.result_received` / `browser.ui_applied` | Returned result length and length of text applied to the editable note, without draft content |
| `browser.error`, `upload.rejected`, `provider.error`, `job.error`, `poll.missing` | Failing stage, safe status/category where known |

The direct multipart path uses `upload.received`, the same provider events and `direct.result`.

All server events include stage, UTC timestamp and correlationId. Browser events also include a clientTimestampMs; network scheduling means they need not arrive in exact chronological order. Browser duration is measured wall-clock recording duration, not a decoded/media-verified duration. Chunk counts include the final empty upload request. Provider request IDs are emitted only when present and matching a restricted format.

## Reading one failed attempt

- No browser start: investigate permission/recorder initialization or missing browser telemetry. Telemetry is best-effort, so its absence alone does not prove recording failed.
- Browser chunks but no accepted upload: inspect upload HTTP/rejection events.
- Tiny/zero assembled bytes or unexpected MIME: recording/upload stage needs investigation; no automatic repair is performed.
- `provider.prepare` with credentialsConfigured=false and missing_credentials: no external call was made.
- `provider.request_attempted` without a response: fetch was invoked, but this does not prove OpenAI received it. Inspect network/error category.
- A non-2xx response: inspect status/category and requestId; no raw provider body is logged.
- A successful response with requestId: use that ID to investigate the relevant provider project/account. An empty usage dashboard alone does not establish that no request occurred.
- Compare `provider.result`, `job.complete`, `poll.result`, `browser.result_received` and `browser.ui_applied` character counts. This locates any length-changing stage without exposing the transcript.

## The word “You”

Source inspection found no successful fallback/default/placeholder that generates this word in the shared recording pipeline. The helper returns `res.text().trim()`. The job uses `text || ''`; polling uses `transcript ?? ''`; the browser initializes drafts to an empty string and uses `String(data.transcript || '')`. Failures throw or return error status, never a substitute transcript. Codec fallback selects a format, not text. Unrelated summary prompts contain the word “You” but do not generate transcription fallbacks.

An offline test makes the mock provider return `You` and confirms that exact result survives helper, assembly job and polling unchanged while logs contain only characterCount=3. An empty or missing result stays empty or fails. Diagnostics deliberately do not log an `isYou` flag, because that would disclose content. The actual recurring failure has not been reproduced against a live provider, so its root cause remains unconfirmed.

## Privacy and limits

The logger allowlists metadata fields; arbitrary error messages, stacks, file paths, user-supplied MIME/codec strings, transcript text, keys, audio, contact details and provider bodies are not serialized. Existing provider-body/error-object logging was removed from the transcription paths. Browser telemetry is authenticated, size/rate bounded, stage restricted and filtered again on the server. It is untrusted observational data, not authority for permissions or provider-call evidence. It can be lost on navigation/network failure or rate limiting; it never blocks recording.

The diagnostic receiver retains only a short-lived in-memory rate counter per authenticated owner, not payloads. This work does not change existing process-local job storage or one-shot result delivery. Investigate restarts or multiple instances if `poll.missing` occurs.

## Local validation

With the isolated local database URL and normal development variables, run:

```sh
node scripts/check-transcription-diagnostics.mjs
npm run check
npm test
npm run build
```

The offline diagnostic runner replaces fetch and verifies multipart format/model, unchanged return text, missing credentials/no call, HTTP/network/read failures, empty results, error redaction, flag gating, diagnostic receiver validation/authentication and correlated upload/assembly/poll. No provider request is made.

For mobile diagnostics, run the built app on loopback port 5176 with RELISH_TRANSCRIPTION_DEBUG=YES, external workers disabled, and DATABASE_URL pointing only to relish_local. Then run:

```sh
PEOPLE_TEST_ORIGIN=http://127.0.0.1:5176 TRANSCRIPTION_DIAGNOSTIC_TEST=YES RELISH_TRANSCRIPTION_DEBUG=YES node scripts/check-my-people.mjs
```

This uses local fixture accounts, fake microphone audio and mocked transcription. The browser test checks all browser stages have one correlation ID and do not include private text. The existing shared handler tests use offline provider responses.

## Validation results

- Type check: zero errors and warnings.
- Production build passed without an OpenAI key.
- Full regression suite: 868 tests; 818 passed and the same 50 pre-existing failures (failure names compared with baseline).
- Offline provider/metadata runner passed all assertions, including response-read errors and exact `You` pass-through without logging it.
- All 14 local People/legacy-route integration checks passed, plus the mobile browser diagnostic-stage/correlation/redaction assertions. No live provider call was made.
- No Prisma migration, production access, deployment, commit, push or environment configuration change was performed for this instrumentation task.

## Changed files

- `src/lib/ai.ts`: correlated provider request/response/result/error events, safe failure messages.
- `src/lib/recording/ContactNoteForm.svelte`: browser stages and diagnostic reference, shared by both recorders.
- `src/lib/recording/transcriptionMetadata.ts`: strict metadata/stage/correlation allowlists.
- `src/lib/server/transcriptionDiagnostics.ts`: runtime flag and structured safe logger.
- `src/lib/server/transcriptionBrowserDiagnostics.ts`: authenticated browser metadata receiver.
- `src/routes/api/upload-chunk/+server.ts`, `transcribe-result/+server.ts`, `transcribe/+server.ts`: server pipeline instrumentation.
- `src/routes/api/transcription-diagnostics/+server.ts`, `src/routes/people/api/transcription-diagnostics/+server.ts`: receiver adapters.
- Both existing Contact and People note page server loads: expose only the debug boolean.
- `tests/core/transcription-diagnostics.test.ts`, `scripts/check-transcription-diagnostics.mjs`, `scripts/check-my-people-browser.py`: privacy, behavior and browser coverage.
- This runbook.
