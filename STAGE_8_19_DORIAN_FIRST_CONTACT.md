# Stage 8.19 - Dorian First Contact and Relationship Onboarding

**Baseline:** Stage 8.18b (portable-tests package)  
**Status:** Implemented in source; needs live provider and database acceptance tests before wider pilot.  
**Prisma migration:** **YES** - `20261026170000_stage8_19_first_contact_policy`.

## Purpose

Make Relish's initial visitor experience genuinely Dorian-first. Dorian is **each participant's AI networking partner**, not the inviter's assistant. A QR scan introduces the participant to Dorian while retaining the relationship provenance privately and preserving separate ContextSpace custody. Dorian should have a recognisable, warm, human-like conversational presence, remain clear that he is AI, and take a natural interest in both what matters to the person and what they can or wish to contribute to others.

This is not matchmaking or automated introduction implementation. The existing `PilotProfileEntry` records the encounter; it is **not** a mutual connection, discoverability grant, or permission for the inviter to access the person's phone, conversation or private Living Understanding.

## Visitor experience

- The public Business / Friendship / Dating QR profile presents the same minimal, mobile-first layout. No technical ContextSpace label is shown to the visitor.
- The primary section is **Meet Dorian - Your AI networking partner**. The single prominent action is **Send Dorian a 'Call me' message**.
- A short description and upfront AI, call, privacy and consent notice remain visible. Longer detail is in expandable **More about Dorian**.
- The second section identifies the person who shared the invitation. Their public profile information is expandable, while **Save contact** remains accessible.
- There is no separate Stay Connected panel and no required registration or lead form. A QR encounter is recorded without sharing the visitor's private identity or details with the inviter.
- The SMS invitation is created by a deliberate server-side POST. JavaScript attempts to open the phone's Messages app immediately upon success. The visitor **must press Send**. If mobile browsers block the SMS handoff, an on-page Open SMS link and manual SMS instructions remain visible.
- Existing `/u/[slug]/call` GET links redirect to the public profile. The old POST action is retained for compatibility but is no longer surfaced in the visitor journey.
- Public profiles still have independently editable public fields. The profile editor now supports **one distinct image per profile**, resizing selected JPEG/PNG/WebP images in the browser to a compact JPEG data URL (max approximately 240 KB binary) before storage. No reliance on ephemeral Railway disk storage.
- The owner's Business / Friendship / Dating workspace controls and QR routes are preserved.

## SMS code contract

**Example:** `Hi Dorian, call me! (ref ABCDJKLM2345QRST)`

- Generates 16 characters from a non-ambiguous base32 alphabet (80 random bits).
- Only a SHA-256 hash of the invitation code is stored.
- Existing 20-minute expiry, single-use atomic claim, environment scoping, signed Telnyx webhook, rate limits, STOP/START handling and proxy routing are retained.
- Older 20-hex-digit `CALL XXXXX` invitations remain parseable during deployment until expired.
- If the active policy changes between invitation issuance and SMS arrival, Relish rejects the outdated invitation, rather than silently attributing an acknowledgement to the wrong policy version.

## Conversational terms and policy acceptance

The previous website-checkbox flow is **replaced** with an explicit voice acknowledgement for new invitations, based on the principle from the earlier Dorian app.

1. The public page includes a short notice and links to the actual, published Terms and Privacy Notice.
2. On receipt of a signed SMS invitation, Relish sends those links to the caller using Telnyx.
3. Dorian introduces himself as AI, gives the recording/transcription and privacy notice, and requests an **explicit** agreement before substantive conversation.
4. On an affirmative answer, Dorian invokes the new ElevenLabs server tool `record_relish_policy_acceptance`.
5. Relish verifies the **shared tool secret, current server-issued session token, provider conversation ID, active Dorian binding, session expiry, participant-owned ContextSpace and policy version** before saving a durable `RelishCallPolicyAcceptance` record. A scan, SMS, silence or model assertion without the valid tool call is not treated as a saved acknowledgement.
6. If acceptance is absent, the signed post-call transcription webhook **does not import that shared-Dorian call into Living Understanding**. The outstanding phone processing gate is released so the caller can try again. The existing preferred-name tool also refuses new personal-data writes while current terms have not been accepted.
7. Subsequent incoming telephone calls check accepted versions and do not ask again unless the currently configured version or document links have changed. Until a new policy is accepted, previous private LU and last-call summary fields are withheld from the initiation payload.

**Limitations and important provider checks:** ElevenLabs may technically handle audio before the tool can record consent. The public notice and follow-up SMS provide advance notice; the provider's recording/retention/consent settings and locally applicable requirements need review. The server-side gate prevents **Relish transcript and LU ingestion** before consent, but does not by itself disable ElevenLabs' initial processing or any provider-held recording. The consent record reflects Dorian's tool assertion based on the caller's answer, and should be considered an auditable application record, not cryptographic proof of the speaker's identity. Returning callers with a newly revised policy may have to call again to restore full LU context after consenting.

### ElevenLabs tool configuration

Add one server-side tool to the **Dorian agent used by this environment**:

- **Tool name:** `record_relish_policy_acceptance`
- **Method:** POST
- **URL (existing proxy):** `https://relish-proxy-server-production.up.railway.app/api/webhooks/elevenlabs/tools/record-policy-acceptance`
- **Authorization header:** `Bearer <ELEVENLABS_TOOL_SECRET>` (same secret already used by the preferred-name tool; set it on the agent/tool configuration, not in prompts).
- **JSON request body** (configured as ElevenLabs variables, not literal template strings):

```json
{
  "agent_id": "<CURRENT_ELEVENLABS_AGENT_ID>",
  "relish_network_session": "<ISSUED_RELISH_NETWORK_SESSION_DYNAMIC_VARIABLE>",
  "conversation_id": "<CURRENT_SYSTEM_CONVERSATION_ID>",
  "agreement": true
}
```

The proxy needs `agent_id` to route the request, but Relish does **not** trust that value as participant identity. Wire the variable names using the existing agent's working dynamic variable configuration; do not hardcode a real session token or conversation ID. The tool must be called **only following an unambiguous affirmative response**. The response must be `{"status":"ACCEPTED", ...}` before Dorian continues. If the tool returns a different status, Dorian should not proceed with substantive discussion. Test an explicit refusal, tool failure and a caller declining to answer.

For browser conversations, the user sees the terms link on the landing page instead of SMS; the initiation policy instruction reflects that distinction.

### New environment variable

```dotenv
# Explicitly allow conversational terms once the provider tool, public documents,
# recording notice and the database migration have been verified end-to-end.
RELISH_PILOT_CONVERSATIONAL_TERMS=YES
```

**Fail-closed:** The normal SMS readiness check requires this flag, as well as the existing configured provider credentials, published HTTPS Terms/Privacy URLs, and policy version. Until configured, the simplified QR page says telephone calling is temporarily unavailable. The flag must be set separately on the actual local / Railway dev / Railway prod application receiving the SMS, not on the proxy.

Existing variables stay in place, including `RELISH_PILOT_SMS_CALLBACK_ENABLED=YES`, `RELISH_PILOT_TERMS_VERSION`, `RELISH_PILOT_TERMS_URL`, `RELISH_PILOT_PRIVACY_URL`, `RELISH_NETWORK_DORIAN_BINDING_ID`, `ELEVENLABS_TOOL_SECRET`, and Telnyx/ElevenLabs provider variables.

## Files changed and added

- `src/routes/u/[slug]/+page.svelte` - guest-only Dorian-first mobile layout and enhanced SMS handoff.
- `src/routes/u/[slug]/+page.server.ts` - deliberate, rate-limited invitation issuance.
- `src/routes/u/[slug]/call/+page.server.ts` - legacy GET redirected to new QR landing.
- `src/lib/server/core/pilotSmsCallback.ts` - friendly SMS code, conversational readiness, policy version check and outbound policy instructions.
- `src/lib/server/core/relishCallPolicy.ts` - policy lookup, session-scoped acceptance and dynamic memory gating.
- `src/routes/api/webhooks/elevenlabs/tools/record-policy-acceptance/+server.ts` - signed tool endpoint.
- `src/routes/api/webhooks/elevenlabs/initiation/+server.ts` - browser and direct-phone policy check.
- `src/routes/api/webhooks/elevenlabs/+server.ts` - post-call fail-closed transcription/LU gate.
- `src/lib/server/integrations/elevenlabs/preferredName.ts` - block new personal-data writes before agreement.
- `src/lib/server/integrations/elevenlabs/networkSession.ts` - Dorian-as-participant-partner instructions.
- `src/lib/server/integrations/elevenlabs/phoneOnboarding.ts` - participant identity is retained in the prepared call result for checking consent.
- `src/routes/settings/profile/+page.svelte`, `.server.ts` - individual profile image selection, client resize and validation.
- `src/routes/space/[context]/profile/+page.svelte`, `src/lib/server/core/relishWorkspaceData.ts` - owner photo preview.
- `src/routes/space/[context]/share/+page.svelte` - introduction-oriented copy.
- `prisma/schema.prisma` and the new migration - durable versioned voice acceptance.
- `tests/core/stage8-19-first-contact-onboarding.test.mjs` and updated legacy Stage 8.18 contracts.

## Local installation (Windows PowerShell)

1. Back up the source and Neon Development database.
2. Extract the complete Stage 8.19 source to replace your current development project.
3. Confirm the new migration directory exists and the abandoned Stage 8.15.4.7a migration is absent.
4. From your RelationshipOS project directory, run:

```powershell
# Create the new durable policy acknowledgement table in Neon Development.
npx prisma migrate dev

# Generate the matching Prisma client.
npx prisma generate

# Start your local development service; no local build required.
npm run dev
```

5. Configure `RELISH_PILOT_CONVERSATIONAL_TERMS=YES`, the current Terms and Privacy URLs, and the new ElevenLabs tool. Do not enable guest testing until the tool returns `ACCEPTED` against the new database table.
6. For production, commit the migration and use your existing Railway migration deployment process against **Neon Production**, not `migrate dev` against production. Ensure the same application/version has been deployed before turning on the new onboarding. No changes to Telnyx's existing proxy webhook URL or the proxy SMS mapping are required.

### Focused regression test (PowerShell)

```powershell
# Run existing telephone, QR and new first-contact source contracts.
$tests = @(Get-ChildItem 'tests/core/stage8-15-4-7*.test.mjs' | ForEach-Object { $_.FullName })
$tests += @(
  'tests/core/stage8-16-three-context-pilot.test.mjs',
  'tests/core/stage8-17-contextual-ui.test.mjs',
  'tests/core/stage8-18-sms-context-callback.test.mjs',
  'tests/core/stage8-18a-sms-diagnostics.test.mjs',
  'tests/core/stage8-18b-default-context-continuity.test.mjs',
  'tests/core/stage8-19-first-contact-onboarding.test.mjs'
)
node --test $tests
```

In the packaging environment, **103/103 targeted tests passed**, including a real Ed25519 webhook signature test, and modified TypeScript files passed syntax parsing. The local dependency install did not finish; full Prisma migration execution, typecheck, browser view and provider round-trip were not run here. Please validate them in your development environment before promoting the stage.

## Acceptance checklist for tonight's pilot or later

- [ ] Owner can edit each of Business / Friendship / Dating separately, including a different profile photo.
- [ ] Owner sees correct QR code; an anonymous visitor sees Dorian first, no context label, no connect form, and can expand the inviter's profile and save their public contact.
- [ ] On iPhone and Android, one tap initiates the prefilled SMS composer; if blocked, the fallback Open SMS link works. No duplicate invitation is made after returning to the browser.
- [ ] SMS text uses `Hi Dorian, call me! (ref XXXXX...)`, 16-character reference, 20-minute expiry and single use.
- [ ] Telnyx -> proxy -> correct Relish environment receives signed webhook; no unexpected `agent_id` requirement on SMS.
- [ ] Dorian calls back with the correct private participant workspace, **without opening by speaking about Terence or the originating context**.
- [ ] The participant receives actual Terms/Privacy links. Dorian identifies as AI and explicitly asks for current agreement before substantive conversation.
- [ ] Verify a refusal or failed tool call creates **no** acceptance record and does **not** import new LU. A subsequent call remains possible.
- [ ] Verify an affirmative response results in a session-authorised `ACCEPTED` record for the current version and resumes the conversation.
- [ ] After processing, a direct return call to the same Dorian number uses the existing default ContextSpace and Living Understanding without repeating current consent.
- [ ] Changing `RELISH_PILOT_TERMS_VERSION` causes a new version-specific voice acknowledgement before processing. Expired/old invitations cannot accept a newer policy silently.
- [ ] Verify QR provenance without granting the inviter access to the participant's phone number, transcript, private LU or default context.
- [ ] Check mobile page does not overflow sideways or expose old CRM navigation.

## Intentional limits

- **No automated network matching, introductions or reciprocal contact grants.** The inviter's QR is simply the provenance of meeting Dorian. Consent to receive a call does not imply permission to share participant details with the inviter.
- Conversation-driven sharing of names or relationship contact details requires a separate, explicitly consented tool and permission model. The old optional lead form is not displayed.
- No arbitrary user-defined ContextSpace creation UI is introduced. Contexts remain extensible in the schema.
- Dorian's appearance and pacing still depend on ElevenLabs agent voice and system prompt, which should be tuned during real calls; this stage changes server-supplied call instructions.
- Third-party audio processing/recording before explicit voice consent must be evaluated in the ElevenLabs configuration and relevant legal/privacy requirements. No claim of complete legal compliance is made by the code alone.
- The photo is stored in a public profile database string after resizing, not in dedicated image storage. Later growth should migrate public avatar media to appropriate object storage; this design avoids using Railway's ephemeral local disk for the small pilot.


## Stage 8.19 configuration hardening update (27 October 2026)

**Renamed, with no backward compatibility alias:**

- `ELEVENLABS_WEBHOOK_SECRET` becomes `ELEVENLABS_POST_CALL_WEBHOOK_SECRET`.
- `RELISH_ELEVENLABS_TOOL_SECRET` becomes `ELEVENLABS_TOOL_SECRET`.
- The older `POST_CALL_WEBHOOK_SECRET` legacy fallback is removed.

The post-call signing secret is the ElevenLabs-generated webhook signature secret. The tool secret is the user-created shared bearer secret for the ElevenLabs Webhook tools. Keep them distinct from `ELEVENLABS_INITIATION_SECRET`. The proxy forwards headers but does not need these names configured unless it independently uses the same service's environment.

**Missing-variable behaviour:** `scripts/start-relish.mjs` validates essential database, encryption and session configuration before starting the web application. With Stage 8.19 SMS/conversational onboarding enabled it validates all the required ElevenLabs, Telnyx, Terms/Privacy and phone settings, including both newly named secrets. Errors list the missing keys without printing secret values. Runtime authentication no longer falls back to legacy/default secrets. Google OAuth no longer defaults to `http://localhost:5173/auth/google/callback`, and magic links no longer default to localhost. The agent test harness no longer assumes someone else's ID or an ngrok hostname. Agent AI model settings and country-code normalisation also require explicit values when their features run.

**Local and Railway configuration checklist:**

```dotenv
# Existing values: rename the keys, keep their current values.
ELEVENLABS_POST_CALL_WEBHOOK_SECRET=<the-current-ElevenLabs-post-call-signing-secret>
ELEVENLABS_TOOL_SECRET=<your-existing-tool-bearer-secret-without-the-Bearer-prefix>

# Now explicit, previously had runtime defaults or weak fallback values.
SESSION_COOKIE_SECRET=<your-existing-cookie-signing-secret>
SESSION_DAYS=30
LOGIN_THROTTLE_SECRET=<a-separate-24-or-more-character-secret>
APP_ORIGIN=https://creative-basilisk-painfully.ngrok-free.app

# Set when Stage 8.19 telephone onboarding is enabled.
TELEPHONY_DEFAULT_COUNTRY=AU
ELEVENLABS_WEBHOOK_MAX_AGE_SECONDS=1800
LU_AUTO_PREPARE_AFTER_INGEST=YES

# Set for the relevant optional AI features rather than relying on model fallbacks.
AGENT_DEFAULT_MODEL=gpt-4o-mini
DATING_REVISION_MODEL=gpt-4o-mini
DATING_KNOWLEDGE_MODEL=gpt-4o-mini
RESEARCH_PROVIDER=none
RESEARCH_OPENAI_MODEL=gpt-4o-mini
```

Replace every angle-bracket placeholder with the actual value. The example model choices are optional examples, not inferred application defaults. Existing `DATABASE_URL`, `SECRET_MASTER_KEY`, OAuth settings and pilot/Telnyx/ElevenLabs settings must also be correct. `SESSION_COOKIE_SECRET` and `SECRET_MASTER_KEY` protect existing data; **do not rotate them merely to rename variables**. In particular, rotating `SECRET_MASTER_KEY` without a data migration breaks decryption and deterministic indexes. When `DB_KEEPALIVE_ENABLED=YES`, set `DB_KEEPALIVE_MINUTES` explicitly. The owner agent test harness additionally requires `ELEVENLABS_TEST_PERSON_ID` and `ELEVENLABS_TEST_PUBLIC_ORIGIN` only when visiting that page.

**Test before starting:**

```powershell
node --env-file-if-exists=.env scripts/validate-required-env.mjs
npm run dev -- --host 0.0.0.0 --port 8080
```

**Prisma migration:** No new migration for this configuration-only update. If Stage 8.19's migration has already been applied, do not rerun `npx prisma migrate dev` for this update.
