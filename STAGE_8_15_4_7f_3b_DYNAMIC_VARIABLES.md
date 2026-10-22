# Stage 8.15.4.7f.3b - ElevenLabs initiation variable contract

## Changes

In `src/lib/server/integrations/elevenlabs/phoneOnboarding.ts`, the provisional telephone initiation response now sends:

- `living_understanding` (previously `relish_living_understanding`)
- `living_understanding_revision` (previously `relish_living_understanding_revision`)
- `relish_network_session` **unchanged**, populated from `input.token`

Other variables including `memory_and_identity_context`, `last_call_summary`, `user_name`, and `call_instruction` remain unchanged. The two obsolete Living Understanding aliases are no longer emitted by this response.

This is a change to the ElevenLabs dynamic-variable contract. Update your ElevenLabs agent prompt/template references to use `{{living_understanding}}` and `{{living_understanding_revision}}`. Keep the `save_preferred_name` tool mapping set to `relish_network_session`. Do not rename the session-token variable.

## Installation

1. Commit or back up the current RelationshipOS folder.
2. Extract the overlay ZIP directly into `C:\Users\teren\Coding\RelationshipOS`, replacing the included source/test files. Preserve `.env` and newer local files.
3. Run the tests below.
4. Update ElevenLabs DEVELOPMENT agent prompt references for the renamed variables, save the agent, then restart the local Relish dev server and place a test call.

**Database migration:** No.
**Local build:** Not required.

```powershell
# Regression tests for the modified initiation response.
node --test tests/core/stage8-15-4-7f-3-next-call-context.test.mjs tests/core/stage8-15-4-7f-3a-last-call-summary.test.mjs tests/core/stage8-15-4-7f-3b-variable-contract.test.mjs

# Full SvelteKit and TypeScript check.
npm run check

# Start Relish for live initiation testing.
npm run dev -- --port 8080
```

The new/updated focused tests passed (10/10) in packaging. Full SvelteKit validation and live ElevenLabs testing have not been executed in this environment.

## Live verification

- Confirm `living_understanding` is present and contains the expected bounded understanding for a returning caller when `RELISH_PHONE_LU_CONTEXT=YES`.
- Confirm `living_understanding_revision` contains the actual revision number.
- Confirm `relish_network_session` is returned on successful provisional initiation. Inspect presence only; do not print/share the token.
- Confirm `save_preferred_name` continues to work with the exact `relish_network_session` mapping and the provider's `system__conversation_id`.
- Confirm `last_call_summary` and `memory_and_identity_context` remain available.

**Caution:** This patch is based on the latest available 8.15.4.7f.3a source overlay. Check for any newer local modifications to `phoneOnboarding.ts` before replacing it; a fresh full repository ZIP will be needed for a definitive integrated baseline.
