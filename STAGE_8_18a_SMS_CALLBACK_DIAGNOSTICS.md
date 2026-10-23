# Stage 8.18a - SMS callback diagnostics hotfix

**Based on:** Stage 8.18 complete source, with Stage 8.17 UX retained.

**Purpose:** Make a Telnyx SMS webhook's *real processing outcome* visible in the Relish server logs, instead of treating HTTP 200 as confirmation that ElevenLabs has called the visitor.

**Prisma migration required:** **NO**. The existing `PilotSmsInvitation` table already holds `status` and `lastErrorCode`.

## What changed

- `src/routes/api/sms/inbound/+server.ts` now generates a request correlation ID and logs: signature rejection, invalid JSON, unexpected event type, verified arrival, and final processing status.
- `src/lib/server/core/pilotSmsCallback.ts` now logs each relevant processing step: invitation issued/claimed/rejected, context setup failures, Terms SMS submission, Dorian session preparation, ElevenLabs outbound request/response and `CALLING` transition.
- Processing exceptions now store a stage-specific `lastErrorCode` (e.g. `PROCESSING_CONTEXT_SETUP`, `PROCESSING_PRIVATE_SESSION`) rather than the uninformative `PROCESSING_ERROR`.
- Terms SMS failure is distinguished from later ElevenLabs failure, and a known Telnyx API HTTP status can be retained as `TELNYX_SMS_HTTP_4xx` / `TELNYX_SMS_HTTP_5xx`.
- Privacy protection: logs contain **no** SMS text, invitation code, telephone number, transcript, Living Understanding, encrypted values, or token. Only the internal request ID, invitation UUID, environment, step and short error/result are logged.
- Existing Telnyx signature checking, once-only claim, caller/owner separation, provider calls and post-call processing are unchanged.
- A new focused test file verifies diagnostics and privacy-sensitive exclusions.

## What to check immediately - before deploying this patch

The already-deployed **SMS proxy** logs `SMS processing outcome=<result>` after its downstream HTTP response. Locate that line for the latest attempt. Possible results include `calling`, `failed`, `expired`, `ignored`, `duplicate` and `disabled`.

Then run this read-only query in the **Neon development database**:

```sql
-- Read-only: inspect the latest SMS invitations without exposing sender identity.
SELECT "createdAt", "environment", "domainKey", "status", "lastErrorCode", "callAttemptedAt", "conversationId"
FROM "PilotSmsInvitation"
ORDER BY "createdAt" DESC
LIMIT 10;
```

Interpretation:

| Status | Interpretation |
| --- | --- |
| `ISSUED` | SMS wasn't claimed by this environment. Check proxy outcome, signature, invitation expiry, environment, phone destination or message format. |
| `CLAIMED` | Claimed but not finalized, possibly interrupted or in-flight. Don't resend the same code blindly. |
| `FAILED` | Read `lastErrorCode`. This identifies the rejected phase. |
| `CALLING` | ElevenLabs accepted the outbound API request. Inspect ElevenLabs conversation/telephony logs next. |
| `COMPLETED` | Downstream conversation processing completed. |

**Likely pilot-specific causes:** A local invitation routed to `dev` produces `expired` because `environment` must match; Telnyx outbound Terms SMS failure prevents the call; testing with a phone already mapped to the *profile owner* can return `CALLER_UNAVAILABLE` (intentionally refuses self-connection).

## Installation

1. Back up your source and retain your Stage 8.18 database.
2. Replace the app source with the attached complete Stage 8.18a source package.
3. **No Prisma migration needed.** Do not run `npx prisma migrate dev` for this patch.
4. Start locally as normal: `npm run dev`, or deploy the updated dev branch to your existing Railway development service.
5. No changes to the proxy, Telnyx webhook URL, ElevenLabs credentials, or production deployment are necessary.

**Important:** The backend logs appear on **whichever Relish server the proxy forwards to**. If `SMS_TARGET_ENV=dev`, look at the Railway Dev logs, not the local terminal. If `SMS_TARGET_ENV=local`, inspect the local terminal and ensure the proxy can reach your local tunnel.

## Example new Relish logs

These are illustrative only, not actual observed results:

```text
{"component":"pilot-sms","action":"webhook.received","requestId":"<uuid>","environment":"dev","eventId":"<telnyx-event-id>"}
{"component":"pilot-sms","action":"invitation.claimed","requestId":"<uuid>","environment":"dev","invitationId":"<uuid>"}
{"component":"pilot-sms","action":"terms_sms.requested","requestId":"<uuid>","environment":"dev","invitationId":"<uuid>"}
{"component":"pilot-sms","action":"terms_sms.accepted","requestId":"<uuid>","environment":"dev","invitationId":"<uuid>"}
{"component":"pilot-sms","action":"session.ready","requestId":"<uuid>","environment":"dev","invitationId":"<uuid>"}
{"component":"pilot-sms","action":"elevenlabs.requested","requestId":"<uuid>","environment":"dev","invitationId":"<uuid>"}
{"component":"pilot-sms","action":"callback.failed","requestId":"<uuid>","environment":"dev","invitationId":"<uuid>","reason":"ELEVENLABS_HTTP_422"}
{"component":"pilot-sms","action":"webhook.completed","requestId":"<uuid>","environment":"dev","reason":"failed"}
```

## Acceptance tests

- [ ] Ensure a valid SMS webhook produces `webhook.received` and `webhook.completed` entries with one request ID.
- [ ] Trigger an invitation for a mismatched environment and confirm `invitation.rejected` with `ENVIRONMENT_MISMATCH`, without any outbound call.
- [ ] Confirm a valid callback emits Terms SMS and ElevenLabs stage transitions.
- [ ] If the Terms SMS provider rejects the request, confirm `FAILED` with `TELNYX_SMS_HTTP_<status>` or `TELNYX_TERMS_SMS_FAILED` and no outbound call.
- [ ] If ElevenLabs rejects the call, confirm `FAILED` with `ELEVENLABS_HTTP_<status>`, with a safe numeric status in logs.
- [ ] Confirm SMS contents, telephone numbers, invitation codes and dynamic variables are absent from all `pilot-sms` log records.
- [ ] Confirm the original inbound telephone and Living Understanding worker paths still operate unchanged.

## Verification and limitations

- All **29** existing/new Stage 8.16, 8.17, 8.18 and 8.18a source-contract tests pass.
- Modified TypeScript files parse successfully. A full SvelteKit typecheck and live provider integration tests were not performed.
- This patch adds diagnostics but does **not** fix a provider configuration issue or an environment mismatch automatically. Diagnose the logged reason, then make the targeted correction.
- Logging currently writes to the server console; it is not yet a persistent operator UI. A later small stage could add an operator callback-monitor page, access-controlled and subject to retention limits.
