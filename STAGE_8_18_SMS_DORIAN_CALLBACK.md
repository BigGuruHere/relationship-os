# Stage 8.18 - SMS-to-Dorian contextual telephone onboarding

**Baseline:** Stage 8.17. **Status:** Implemented in source, pending live Telnyx/ElevenLabs and database verification. **Prisma migration: YES.**

## 1. Purpose

Complete the first-contact pilot through one shared Dorian telephone number without requiring a browser voice widget. A person scans the relevant Business, Friendship or Dating QR, saves the owner's contact if they wish, chooses to talk to Dorian, accepts the terms on the mobile handoff page, sends a short prefilled SMS and receives an outbound call from Dorian. The invitation, not the destination phone number, determines the conversation context. A participant may also offer their name and email to the profile owner.

**The original inbound telephone workflow, Dorian automatic understanding worker, Operator/Conversation Monitor, Business Broker and three-context UI remain in place.** This stage does not migrate or merge private people between contexts.

## 2. Visitor experience

1. Open a public profile `/u/<slug>` through QR or direct link. The Save contact to phone vCard button is now visible to all non-owner visitors across all three types, without requiring login or a connection.
2. Choose Call Dorian by phone (the default; a context owner can select the older browser widget instead).
3. Open `/u/<slug>/call`, read the terms and privacy notice and check agreement. Optionally check *Also share my contact details* and enter name/email. This separate choice is not implied by the phone call.
4. Relish issues a random 80-bit, single-use invitation valid for 20 minutes. The web page opens the phone's SMS composer containing `CALL <code>` to the configured Dorian number. **The visitor must personally press Send.** A visible text-and-number fallback supports phones that do not open the SMS link.
5. A verified Telnyx SMS webhook validates the code and number, resolves or provisions an isolated telephone Person, creates the relevant private ContextSpace and `PilotProfileEntry`, optionally creates a scoped accepted or pending connection request, sends an SMS with terms/privacy notice, and requests an outbound SIP call from ElevenLabs.
6. The ElevenLabs SIP call is created with `conversation_initiation_client_data` populated using the existing private `prepareNetworkDorianContext` and a server-issued `relish_network_session`.
7. A signed post-call webhook links the conversation to the private participant ContextSpace and queues the existing automatic Living Understanding worker when `RELISH_PHONE_AUTO_LU=YES`.
8. A second new SMS invitation from the same phone number and same context can reuse the caller's provisional Person and that context's private understanding.

**Identity limits:** Phone number recognition is provisional, not authenticated identity. An unrelated visitor cannot be granted the profile owner's private understanding. Account claiming and verified phone-to-account merging are not included.

## 3. Implementation map

- `src/routes/u/[slug]/+page.svelte`: universal Save Contact button, context-aware Call Dorian link and basic mobile overflow containment.
- `src/routes/u/[slug]/call/+page.server.ts` and `+page.svelte`: server-issued invitation and explicit consent before opening SMS composer.
- `src/routes/api/sms/inbound/+server.ts`: signed Telnyx messaging webhook, replaces the inactive Twilio/TwiML placeholder.
- `src/lib/server/integrations/telnyx/messaging.ts`: raw-body Ed25519 verification (timestamp tolerance 5 minutes) and outbound Telnyx text notice.
- `src/lib/server/core/pilotSmsCallback.ts`: short-lived invitation, atomic one-time consumption, 3 per-sender callback attempts per rolling 24 hours, opt-out support, contact sharing, separated custody, session creation and ElevenLabs outbound SIP API call.
- `src/lib/server/integrations/elevenlabs/phoneOnboarding.ts`: extraction of shared provisional caller provisioning, retaining the existing inbound phone session behaviour.
- `src/lib/server/integrations/elevenlabs/preferredName.ts`: session-authorised preferred-name saving now supports callback pilot sessions in a validated non-General workspace.
- `src/routes/api/webhooks/elevenlabs/+server.ts`: confirmed outbound post-call callbacks are attributed and marked completed, and trigger existing LU processing.
- `/space/<context>/settings`: context-specific acceptance and Dorian channel settings.
- `/space/<context>/people`: owner can approve pending requests.
- `/general/admin/product-intelligence`: added SMS invitation and callback funnel events.
- `prisma/migrations/20261023130000_stage8_18_sms_context_callback/`: invitation, preferences and SMS opt-out persistence.

No abandoned Stage 8.15.4.7a migration has been reintroduced.

## 4. Installation

1. Back up your current development source and Neon development database.
2. Replace your local source with the **complete Stage 8.18 ZIP**.
3. If dependencies are missing, run `npm install`.
4. **Prisma migration required: run `npx prisma migrate dev`.**
5. Run `npx prisma generate` if your normal install/migration process did not regenerate the Prisma client.
6. Add the environment settings below to your development environment only, configure the Telnyx webhook and start your normal `npm run dev` development process.
7. Validate the complete flow in development before merging and pushing to master. Existing Railway `start:with-migrations` still runs `prisma migrate deploy` on production startup. Make sure it is still the effective Railway startup command for both services as configured.

No local `npm run build` step is required.

## 5. New environment settings

Add these to the correct deployment environment. **Do not commit secrets.**

```dotenv
# Feature flag. Leave disabled until all provider and legal URLs are configured.
RELISH_PILOT_SMS_CALLBACK_ENABLED=YES

# The existing Dorian Telnyx number, with +country code, used for inbound SMS and outbound voice.
RELISH_DORIAN_SMS_NUMBER=+61XXXXXXXXX

# Telnyx Messaging API credentials and account Ed25519 public key (base64 raw 32-byte key).
TELNYX_API_KEY=<secret>
TELNYX_PUBLIC_KEY=<public-key-from-Telnyx-portal>

# ElevenLabs API access and the *phone number ID*, not the dialled telephone number.
ELEVENLABS_API_KEY=<secret>
ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID=<imported-sip-phone-number-id>

# Published HTTPS documents. Keep these current and legally reviewed.
RELISH_PILOT_TERMS_URL=https://YOUR-DOMAIN/terms
RELISH_PILOT_PRIVACY_URL=https://YOUR-DOMAIN/privacy
RELISH_PILOT_TERMS_VERSION=2026-10-pilot-1

# Existing shared Dorian and LU settings must remain configured as in 8.17.
RELISH_NETWORK_DORIAN_BINDING_ID=<existing-shared-binding-id>
RELISH_PHONE_AUTO_LU=YES
```

The UI refuses to issue SMS invitations unless the required number, provider credentials, shared binding and HTTPS terms/privacy URL settings are present. Existing signed ElevenLabs post-call configuration remains required.

**ElevenLabs phone number ID:** Find the imported SIP phone number in ElevenLabs Phone Numbers or the Phone Numbers API. The SIP outbound endpoint requires `agent_id`, `agent_phone_number_id`, `to_number` and optional `conversation_initiation_client_data`.

**Telnyx Messaging Profile:** Assign Dorian's number to a Messaging Profile that can receive SMS and send SMS to Australian mobiles. Set its primary **inbound messaging webhook** to `https://dev.relish.live/api/sms/inbound` for the dev deployment or the corresponding production domain. The webhook URL's hostname must be the *same app environment* that issued the invitation: local/ngrok URL -> `local`, `dev.relish.live` -> `dev`, `app.relish.live` -> `prod`. Set the separate live `TELNYX_PUBLIC_KEY` per Telnyx account. Existing SIP inbound routing is not changed.

**Do not paste Telnyx or ElevenLabs keys, passwords or session tokens into screenshots or chats.**

## 6. Preferences and connection semantics

The context owner can choose in each context's Settings:

- **Automatic acceptance** (default): If a visitor explicitly checks the sharing option and provides name/email, the resulting scoped `PilotConnectionRequest` is created in `ACCEPTED` status.
- **Require approval:** Creates a `REQUESTED` status. The owner can accept from that context's People page.
- **SMS callback** (default): visitor's Call Dorian link goes to the mobile SMS handoff.
- **Browser voice**: existing widget session route stays available for the relevant profile, without changing telephone routes.

Acceptance currently records a scoped Relish connection request with volunteered contact details and profile/participant association. It **does not** auto-create a fully verified, reciprocal CRM Contact row or grant either person access to the other's private Living Understanding.

The SMS caller's `NetworkPhoneCaller` identity is independent from any browser-only provisional identity they may already hold. Automatic merging would be unsafe without verification and is not part of this stage.

## 7. Security, telemetry and recovery

- SMS inbound messages are processed only after a valid Telnyx Ed25519 signature over the exact raw body and timestamp.
- The invitation is 80 random bits, SHA-256 indexed, 20-minute expiry, single-use, with an atomic `ISSUED` -> `CLAIMED` transition.
- Signed webhook retries do not make repeated calls. The sender is rate limited to 3 attempted callbacks per rolling 24 hours. `STOP`, `UNSUBSCRIBE`, `CANCEL`, `QUIT` opt out of texts, and `START` opts back in without placing a call.
- A scan or browser click alone cannot trigger a call. The sender must actually send an SMS. Caller ID is used as a provisional continuity signal, never to log into an existing account.
- Optional connection details are encrypted, and consent is separate from joining the conversation. Neither transcripts, LU, phone numbers nor session tokens are copied into product analytics events.
- Invitations older than 30 days are cleaned up when a new invitation is issued. Plan a periodic database cleanup as pilot usage increases. Do not assume low-volume cleanups are continuous.
- Product Intelligence distinguishes SMS invitations created, received, accepted call dispatches, and provider-confirmed spoken conversations. An outbound API 200 is **not** counted as a conversation completed.
- If an outbound API request succeeds but its database update fails, the webhook can be received while the session is not yet bound to the provider conversation. This fails closed and needs operator review, not automatic redial. Never retry blindly.

### Currently out of scope / limitations

1. Returning callers who dial Dorian directly, without a new SMS invitation, still use the existing **General inbound telephone path**, not automatic Business/Dating context selection. For context-specific continuity during this pilot, launch another SMS invitation from the relevant profile.
2. A public QR visitor does not become a verified registered Relish user. Email/phone verification, identity claiming, multi-device recovery and merging browser-phone provisional identities remain later stages.
3. SMS composer URL compatibility varies on iOS and Android. The page provides a manual message fallback.
4. Telnyx delivery status and answered/voicemail status are not separately tracked. Provider-confirmed spoken post-call evidence counts as the completed conversation.
5. This uses first-party request throttling and per-number caps. For a larger public rollout, add IP/device-independent abuse rate limiting and an asynchronous, durable callback outbox.
6. No live Neon migration, SMS provider callback or ElevenLabs SIP call was executable in this development environment. All provider-specific settings must be verified on your own test deployment.

## 8. Acceptance tests (run in development)

### QR and visual

- [ ] Publish Business, Friendship and Dating, scan each QR on a mobile device.
- [ ] Verify the **Save contact to phone** action appears on all three profiles while logged out, does not require a login, and downloads the correct `.vcf`.
- [ ] Check 320px, 375px and 430px device widths. No horizontal scrolling or jumpy page layout; also test iOS Safari and Android Chrome.
- [ ] Verify the context name and profile owner on the call page, with distinct consent to private processing and optional sharing.
- [ ] Switch one context to Browser in Settings and verify its profile opens the existing browser flow without changing the other contexts.

### SMS / callback and custody

- [ ] With the feature flag OFF, the call page must refuse to start the SMS process.
- [ ] With feature flag ON and valid HTTPS legal URLs, create a Business invitation and send its prefilled `CALL <code>` SMS from your own mobile.
- [ ] Confirm the Telnyx Messaging Profile shows `message.received` to `/api/sms/inbound`; signature accepted.
- [ ] Confirm Relish sends the terms/privacy notice SMS, and ElevenLabs calls the same mobile from the one Dorian number.
- [ ] Verify Dorian introduces himself as AI and identifies the **Business** context without reading the profile owner's private LU.
- [ ] Speak for at least one meaningful exchange, hang up, inspect Conversation Monitor, and confirm the transcript is ingested into the provisional visitor's **Business** ContextSpace, not the owner's.
- [ ] With automatic processing enabled, verify the worker creates/updates that visitor's private LU; repeat with a new Business invitation from the same mobile and confirm context-specific continuity.
- [ ] Repeat once for Friendship (General) and Dating; confirm no cross-context disclosures or swapped records.
- [ ] Verify calling Dorian directly still works via the original General phone flow.

### Connections, settings and failures

- [ ] With automatic acceptance selected, check optional contact sharing, provide name/email, send SMS and confirm the connection appears as Accepted only in the owner's corresponding People page.
- [ ] With approval selected, repeat and confirm the request stays Requested until the owner clicks Accept.
- [ ] Without checking the sharing option, confirm no connection request is created despite the call.
- [ ] Send an expired invitation, an invalid code, a repeated valid code, and an unrelated text; none must initiate a new callback.
- [ ] Resend the same signed Telnyx message as a webhook retry and confirm no duplicate callback.
- [ ] Submit unsigned or tampered webhooks and confirm HTTP 401.
- [ ] Send STOP; confirm later invitations from that sender cannot start callbacks until START is received.
- [ ] Initiate 4 callbacks from one sender in 24 hours; verify the fourth is not originated.
- [ ] Inspect Product Intelligence for separate Business/Friendship/Dating cohort totals.
- [ ] Verify existing ElevenLabs inbound sessions, phone processing readiness and Dorian Conversation Monitor still work.

## 9. Source checks

- Existing Stage 8.16 and Stage 8.17 contract tests: 15 passed.
- Stage 8.18 source/security tests: 11 passed, including real valid, altered and stale Ed25519 webhook signatures.
- TypeScript parser check: see release summary. **Not a complete typecheck.**
- A full `npm ci`/SvelteKit check did not complete in the available environment (npm exited internally). No claim is made that Svelte compiler, Prisma migration execution, or live integrations passed.

## 10. Future stages

Once this path is tested end to end, address guest mobile presentation issues, verified identity claiming, seamless direct-call context selection, durable async callback jobs and then broker-product separation. Keep the single Dorian telephone identity and preserve ContextSpace privacy boundaries under agent-guided routing.
