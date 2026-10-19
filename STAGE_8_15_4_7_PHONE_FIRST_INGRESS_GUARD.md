# Stage 8.15.4.7 — Phone-first ingress guard (first pilot-readiness slice)

## Status
Code delivered. **Not a complete phone identity/ownership implementation.** No migration.

## What changed
- Successful initiation for shared Dorian now emits an explicit RESPONSE log. It still returns only generic, privacy-safe context for unverified inbound SIP calls.
- Signed post-call events without user speech are acknowledged as `ignored_no_participant_speech` instead of throwing HTTP 500. No Interaction is created.
- Signed shared-Dorian calls with an apparent phone channel but no valid Relish Network session get HTTP 202 `unlinked_phone_call` instead of HTTP 403. Their transcripts are **not** stored in any user workspace, including the deployment owner's.
- Browser sessions continue to require an authentic `relish_network_session` and continue to use the existing participant custody path. Missing sessions on non-phone events still result in 403.

## Security caveat
`unlinked_phone_call` is only an acknowledgement/diagnostic, **not** evidence of participant identity. `caller_id` is not a trusted login. `202` must never be treated as a successful transcript import. Do not invite external participants expecting their telephone conversations to populate Living Understanding yet.

## Remaining stages before actual telephone pilot
1. Design and implement verified Relish user ↔ telephone number enrollment and revocation (likely new schema + migration). Include phone possession proof and duplicate/reassigned-number handling.
2. Establish server-issued telephone conversation session with unguessable token hash, fixed agent deployment, conversation binding, lifetime and retry idempotency. The initiation webhook must mint/resolve that session only after adequate proof, and supply its token to ElevenLabs.
3. Gate real-time tools and transcript custody on verified phone session; add DB integration tests for User A vs User B and spoofed callers.
4. Bind the inbound number to the Dorian agent deployment through the existing `AgentProviderBinding.inboundPhoneIdx`/encrypted field using the application's binding management path; never manually write plaintext identifiers to the index.
5. Add robust inbound call diagnostics and consent notices; remove temporary auth diagnostics and rotate exposed initiation secret.

## Installation
This is a full source ZIP based on Stage 8.15.4.6c (whose runtime is based on 8.15.4.6b), **not** a patch against the exact local files currently edited. Back up the current `+server.ts` files first. If retaining the temporary initiation/signature diagnostic edits from local, merge those changes rather than overwriting them blindly.

1. Copy source changes to local branch, retaining local `.env`.
2. Run `npm run check` and `node --test tests/core/stage8-15-4-7-phone-ingress-safety.test.mjs`.
3. No database migration / no `prisma migrate dev`.
4. Restart `npm run dev -- --port 8080` and leave gateway routing explicitly on LOCAL.
5. Call Telnyx with test number. Expected logs: initiation RESPONSE; post-call normalized; response `unlinked_phone_call` (202) for speech, or `ignored_no_participant_speech` (200) for empty calls.
6. Recheck browser user A/B session ownership hasn't regressed. Do not infer production readiness from structural tests.

## Explicit limits of testing
The included tests are structural/source assertions, not database or real telephony integration tests. End-to-end proof requires the user's dev runtime, real ElevenLabs/Telnyx calls, and scoped Neon records.
