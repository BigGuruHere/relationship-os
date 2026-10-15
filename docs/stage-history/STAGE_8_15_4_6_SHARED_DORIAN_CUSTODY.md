# Stage 8.15.4.6 - Shared Dorian, participant-owned conversations

**Migration required: YES**
`20261015153000_stage8_15_4_6_network_dorian_sessions`

## Scope
- Configurable shared Dorian binding `RELISH_NETWORK_DORIAN_BINDING_ID` (AgentProviderBinding.id). Must reference an active DORIAN ElevenLabs deployment.
- The Network Dorian page supports a participant-created short-lived session through an authenticated POST.
- A 256-bit random session token is passed to ElevenLabs in the browser widget's `relish_network_session` dynamic variable; only its SHA-256 hash is stored in `NetworkDorianSession`.
- The signed transcription webhook checks the shared binding and the session mapping before assigning transcript custody. Unknown/replayed-for-another-conversation tokens fail closed.
- `NetworkDorianSession` maps participant user, General ContextSpace, self-contact, originating binding and provider conversation id. The webhook retains the existing transcript, evidence and human-approved LU review pipeline.
- Shared initiation callbacks do not access the binding owner's private context, even when a call has no participant resolution.
- The local participant-owned deployment path from 8.15.4.5 remains available when a shared binding is not configured.

## Setup
1. Ensure Stage 8.15.4.5 is installed and backups are current.
2. Install this complete-source release.
3. On development, apply the migration with `npx prisma migrate dev` once, then `npx prisma generate`.
4. Find an existing active ElevenLabs DORIAN binding in Prisma Studio's `AgentProviderBinding` table. Set `RELISH_NETWORK_DORIAN_BINDING_ID=<binding UUID>` in your **development** `.env`. Do not use the ElevenLabs agent ID here. Ensure the existing ElevenLabs webhook is configured to call Relish's signed post-call transcription endpoint and that the webhook secret is configured.
5. Restart development server. For production, set the binding ID separately and deploy the migration through the existing production migration workflow.

## Commands (local)
```
npx prisma migrate dev
npx prisma generate
npm run check:stage8.15.4.6
npm run check:stage8.15.4.5
npm run check
```
No local build command.

## Tests
1. As participant A with a General ContextSpace and a unique self-contact (`Contact.linkedUserId == A.id`), visit `/network/dorian`. Press Start Dorian session. Confirm the ElevenLabs widget opens.
2. As participant B, do the same. Ensure the sessions are distinct and that the token hashes, user IDs and ContextSpace IDs differ.
3. Conduct a brief call from both A and B. Check in the database that each original transcript and attached evidence belongs to the correct participant's General ContextSpace. **Do not enable broader user testing until this is proven.**
4. Check LU handoff creates only a review/proposal in each participant's own context and does not make private information shareable.
5. Send a webhook with missing/invalid `relish_network_session` for the configured shared binding and confirm HTTP 403 with no transcript stored. Repeat a valid session against a second conversation ID: it must be rejected.
6. Ensure the shared agent initiation webhook does not return the agent binding owner's private name/LU.
7. Verify unrelated Business/Dating/telephony webhook flows still work with their own bindings.

## Known limitations / pilot gate
- Source-level tests pass, but Prisma validation, TypeScript checking, actual ElevenLabs widget behaviour and webhook/database integration have **not been exercised here**. Treat the stage as a candidate requiring local checks, not a certified live pilot.
- The provider must echo `conversation_initiation_client_data.dynamic_variables.relish_network_session` in its post-call payload. If the provider omits that, the shared callback fails closed. Verify using a real test call.
- Requires a unique self-contact for each member. A workflow to provision missing self-contacts remains necessary.
- Uses the existing legacy webhook transcription and LU handoff. No new automatic authoritative LU publishing is added.
- Shared agent should use a generic persona/prompt with no owner-specific private context embedded in its ElevenLabs configuration. This application cannot remove private context already stored in an external provider's agent prompt or knowledge base.
- Maintain stable existing migration files. A request for an extra migration requires diff inspection, not accepting destructive changes.
