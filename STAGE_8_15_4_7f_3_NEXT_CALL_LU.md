# Stage 8.15.4.7f.3 - Provisional telephone next-call Living Understanding

## Summary
This pilot-focused increment uses the existing authoritative Living Understanding retrieval service for a returning provisional caller and supplies bounded, caller-scoped context to ElevenLabs through its existing initiation `dynamic_variables`. There is no new memory store and no automatic cross-context access.

## What changed
- `phoneOnboarding.ts`: inside the already verified provisional caller mapping, retrieve `getCurrentLivingUnderstanding()` within `runWithWorkspaceCustody` for that caller's User, ContextSpace and Contact.
- Include up to 12 authoritative topics, maximum 6,000 characters, in `memory_and_identity_context` and `relish_living_understanding` and the revision number in `relish_living_understanding_revision`.
- Retain session and preferred-name behaviour; do not include prior call summaries or drafts.
- If retrieving the context fails, return the existing `WAIT` state rather than risk incorrect private-memory delivery.
- Gate this new behaviour using `RELISH_PHONE_LU_CONTEXT=YES`, disabled by default. This is an explicit pilot choice to allow telephone-number continuity; caller ID is NOT strong identity proof.

## Installation
Apply the overlay to the current local checkout, not the historical baseline. Preserve `.env`. There is no Prisma migration and no local build is required.

## Development configuration
Set `RELISH_PHONE_LU_CONTEXT=YES` in the development Relish process's environment. Keep `RELISH_PHONE_AUTO_LU=YES` and the separate development queue worker running if testing automatic update and readiness. Restart Relish after changing environment variables. **Do not enable this feature for production or external pilots until acceptance testing and consent arrangements are complete.**

## Commands (PowerShell)
```powershell
# Check all TypeScript and Svelte components.
npm run check
# New source-level regression checks.
node --test tests/core/stage8-15-4-7f-3-next-call-context.test.mjs
# Prior stages.
npm run check:stage8.15.4.7e
npm run check:stage8.15.4.7f.1
```

## Manual tests
1. With flag OFF, repeat phone call and verify no private understanding dynamic variables are populated.
2. With flag ON, make an initial conversation, complete auto-processing, and call again from the same number. Confirm `relish_living_understanding_revision` matches the participant's saved revision and Dorian uses the information naturally.
3. Correct a previous statement, complete processing, call again, and check the new revision is used.
4. Call while the previous call is processing: verify the `WAIT` response and no privileged session token is delivered.
5. Call from a second number: verify the second participant never receives first participant's private LU.
6. If LU retrieval fails, confirm the caller receives the wait response and no name or private topic is logged.
7. Verify `save_preferred_name` remains functional and the Dorian Conversation Monitor still shows linked authoritative revisions.

## Limitations
- This is a source-tested patch; no live Neon/ElevenLabs acceptance test has been run here.
- Existing worker scheduling and missing-webhook recovery still need deployment hardening.
- Per-topic relevance selection is currently limited to bounded first 12 persisted topics, not semantic selection.
- Initiation sends this context to the agent on recognition of a phone number. Confirming the spoken preferred name is a conversational courtesy, not a technical barrier to the model seeing the context. This is the explicitly accepted pilot tradeoff; do not assume this is appropriate for sensitive deployment or cross-context sharing.
- No historical baseline ZIP in this conversation contains all newer local changes, so the overlay is the safe installation method.
