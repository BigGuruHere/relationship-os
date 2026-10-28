# Relish — Stage 8.20.2: Dorian Consent Procedure and Context Continuity

**Baseline:** Stage 8.20.1 — Dorian Call Recovery (the complete Relish source ZIP provided with this stage is based on that version).  
**Scope:** Relish application only. No changes to the standalone Agent Management console, ElevenLabs agent ID, SMS/telephony proxy, or database custody.  
**Prisma migration:** **NO.** No database schema changes.  
**New environment variables:** **NONE.**

## Decision implemented

For this **pilot**, consent controls **whether Dorian may begin substantive conversation**, *not* whether the already-authorised participant-specific call context is placed in the ElevenLabs initiation payload.

The previous `withConsentGate()` method emptied `user_name`, `memory_and_identity_context`, `living_understanding`, `relish_living_understanding`, `last_call_summary` and the Living Understanding revision while current consent was missing. This meant that even after consent was granted during a call, Dorian could not immediately access his returning participant context. **Stage 8.20.2 removes that redaction.**

The updated flow is:

1. **Before initiation:** Relish independently determines the authorised participant, ContextSpace, bounded Living Understanding, preferred name, previous-call information and server-issued session token, as before.
2. **At initiation:** Send the **entire existing authorised context**, together with server-computed `relish_terms_status=REQUIRED|ACCEPTED` and a high-priority instruction in `call_instruction`.
3. **When required:** Override the opening with the existing consent-first greeting. Dorian states that he is an AI networking partner, provides the recording/transcription/private-processing notice, points to the Terms and Privacy Notice and requests explicit verbal agreement. No substantive conversation, memory disclosure or other Relish tool calls before acceptance.
4. **On explicit agreement:** Dorian invokes the **existing** `record_relish_policy_acceptance` tool with `agreement=true`, the active `conversation_id` and `relish_network_session`. Wait for the server response `status=ACCEPTED`.
5. **After ACCEPTED:** Continue **the same call** with the name, context, Living Understanding and last-call summary already present. Do not repeat introductions or ask for another call.
6. **If declined, unclear after clarification, policy unavailable, or acceptance tool fails:** Politely end the call using ElevenLabs' existing built-in `end_call` tool.
7. **If previously accepted:** Dorian begins the normal scenario/ContextSpace conversation without repeating terms.

The **mandatory consent instruction is placed *before* editable persona, scenario and ContextSpace instructions**, so it is not buried at the end of the prompt.

## Preserved server safeguards

- `record_relish_policy_acceptance` still validates the provider's tool authorization, issued `relish_network_session`, matching ElevenLabs `conversation_id`, deployment binding, session expiry, participant-owned ContextSpace, and current published Terms and Privacy version/URLs.
- `save-preferred-name` still refuses writes until current voice consent is accepted.
- The signed post-call webhook still skips Relish transcript/Living Understanding import when required policy acceptance is absent.
- No inviter data or unauthorised cross-ContextSpace records are added to the initiation payload. This stage only preserves data that the *existing* projection was already authorised to return.
- Caller processing/wait notices and Stage 8.20.1 operator recovery controls remain unchanged.
- The exact matching of **policy version + terms URL + privacy URL** is unchanged. Acceptance in Local does not automatically imply acceptance in Dev or Prod merely because their documents have the same content.
- No additional post-consent data retrieval tool is added.

**Pilot privacy trade-off:** ElevenLabs receives the already-authorised participant-specific context *before* the new Terms are accepted, even though Dorian is instructed not to use or disclose it until acceptance. This is an intentional pilot decision, **not** a guarantee of technical isolation from the AI/provider. Existing notice, provider settings and legal/privacy obligations still apply; server-side gates continue protecting Relish tool writes and post-call ingestion.

## Files changed

| File | Change |
|---|---|
| `src/lib/server/core/relishCallPolicy.ts` | Consent-first procedure and priority, plus re-export of shared non-redacting projection. Policy matching and acceptance persistence unchanged. |
| `src/lib/server/core/dorianConsentProjection.ts` | **New** pure helper: retains all existing dynamic variables, sets server-owned consent status, prepends required procedure to `call_instruction`. |
| `src/routes/api/webhooks/elevenlabs/initiation/+server.ts` | Documents the new behaviour for returning inbound phone calls. Existing browser/phone flows use the shared helper. |
| `src/lib/server/core/pilotSmsCallback.ts` | Documents the identical behaviour for outbound QR/SMS callback calls. |
| `src/lib/server/integrations/elevenlabs/dorianControlPlane.ts` | The consent-first greeting now includes the recording/processing notice and explicit agreement question. |
| `tests/core/stage8-20-2-consent-context-continuity.test.mjs` | **New** functional and cross-path regression tests. |
| `STAGE_8_20_2_DORIAN_CONSENT_CONTEXT_CONTINUITY.md` | Copy of these stage notes in the source package. |

## Installation — Local / Railway Development

1. Save or commit any local edits you made after Stage 8.20.1. **Merge** the changes if there are uncommitted local modifications rather than overwriting them blindly.
2. Extract **Relish_Stage_8_20_2_Dorian_Consent_Continuity_Complete_Source.zip** into your `RelationshipOS` repository, preserving relative paths.
3. **No `npx prisma migrate dev` is needed for Stage 8.20.2.** The earlier Stage 8.20.1 recovery migration remains included in the full ZIP. If that previous migration is already applied, leave it alone.
4. Restart the Local Relish server. For Railway Development, commit and deploy the same source through your normal workflow.
5. Keep the current environment variables and published Local/Dev Agent Management configurations. `RELISH_PILOT_CONVERSATIONAL_TERMS=YES` is still required for the pilot voice consent procedure. `RELISH_PHONE_LU_CONTEXT=YES` is still required if you want previous phone Living Understanding included for returning callers; this flag is separate from consent.
6. Confirm the Dorian **ElevenLabs system prompt actually incorporates `{{call_instruction}}`**, and the existing `record_relish_policy_acceptance` tool and built-in `end_call` tool are available. The instructions are supplied by Relish, but they cannot be followed if the agent prompt ignores this variable.
7. The proxy still needs to route the shared agent ID's initiation, tool, and post-call requests to the same testing environment. Local and Railway Dev may share Neon Development but use distinct legal-page URLs, so they may ask for consent independently under the existing matching rules.

### Focused local test command

```powershell
node --experimental-strip-types --test `
  tests/core/stage8-19-first-contact-onboarding.test.mjs `
  tests/core/stage8-20-single-agent-console.test.mjs `
  tests/core/stage8-20-1-dorian-recovery.test.mjs `
  tests/core/stage8-20-2-consent-context-continuity.test.mjs
```

## End-to-end acceptance test checklist

Perform with a **controlled pilot identity** in Local or Railway Development, not Production first.

1. **Returning caller requiring acceptance:** Temporarily use a test Terms version or the environment whose Terms URL has not been accepted. Verify initiation has `relish_terms_status=REQUIRED`, a nonempty `user_name` (if chosen), and the same bounded Living Understanding/summary as before the change. Use secure local logs or a local test harness only; **do not log raw tokens or private participant context**.
2. **Consent-first opening:** Dorian starts with Terms and Privacy, **not** prior-call topics or normal prompts.
3. **Explicit acceptance:** Say yes. Verify tool returns `ACCEPTED`, then Dorian uses the earlier context and continues **without hanging up or asking to call back**. Verify durable policy acceptance exists and the call processes normally.
4. **Decline:** On a fresh controlled test identity, decline. Dorian ends the call; no preferred-name persistence or post-call LU import occurs; the caller gate returns `READY`.
5. **Accepted returning caller:** On the next call, Dorian does not request the same acceptance again and uses the familiar greeting/context.
6. **Tool failure:** Simulate a failed acceptance tool in a non-production test. Dorian must not proceed to substantive discussion.
7. **Regression:** Verify Stage 8.20.1 Call Recovery panel remains present and the queued/working protection still operates.

**Limitations of automated testing:** Source and pure-function regressions cannot establish actual ElevenLabs voice behaviour; verify the system prompt, provider tool response and spoken flow in an end-to-end call before Production release.

## Production rollout

After Development passes, deploy Stage 8.20.2 code to Railway Production, confirm it points to Neon Production, keep `RELISH_CONTROL_PLANE_ENV=prod` and the Production read token, publish/review Dorian's Production configuration, and perform one controlled Production call. Existing Production Terms matching remains unchanged. No Prisma migration and no Agent Management service redeployment are required for this stage.
