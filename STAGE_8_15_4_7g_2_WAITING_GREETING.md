# Stage 8.15.4.7g.2 - Processing Wait Greeting / Pilot Acceptance

## Scope

The phone initiation readiness gate already rejects an additional substantive call while the preceding Living Understanding processing job is not READY. Previously the initiation override was generic. Now the `WAIT` result carries the provisional participant's scoped preferred name, and the initiation response overrides ElevenLabs' first message with:

- With preferred name: `Hi [name]. I'm just processing our last call. Could you call me back in a few minutes?`
- Without preferred name: `Hi there. I'm just processing our last call. Could you call me back in a few minutes?`

No Relish session token, private Living Understanding, previous summary or other confidential context is returned on the processing-only branch.

## Important ElevenLabs configuration requirement

An initiation webhook can override the first spoken message, but it **cannot by itself guarantee a call disconnect**. Enable the ElevenLabs built-in `end_call` tool for the DEVELOPMENT Dorian agent and include this explicit instruction in the agent system prompt:

> When `{{relish_identity_status}}` is `PROCESSING`, speak only the provided first message and immediately invoke the built-in `end_call` tool. Do not ask a question, accept a substantive conversation, or call Relish tools. In all other states, follow normal conversation instructions.

In ElevenLabs agent Security, confirm that **First message** overrides from the initiation webhook are enabled. If the wait message is heard but the call stays open, verify the end_call tool and prompt rather than modifying database state.

## Installation

1. Back up or commit the current RelationshipOS project.
2. Extract the full ZIP's `relationship-os-development` folder contents over the existing project, while retaining local `.env` and any uncommitted changes.
3. No Prisma migration and no local production build are required.
4. Run `node --test tests/core/stage8-15-4-7g-2-waiting-message.test.mjs tests/core/stage8-15-4-7g-1-worker-startup.test.mjs`.
5. Run `npm run check` and restart local Relish with `npm run dev -- --port 8080`.

## Pilot acceptance tests (must still be run live)

1. **Known caller:** While this caller's previous job is processing, initiate another call. Confirm the greeting uses their stored name, no `relish_network_session` is issued, no new substantive conversation is accepted, and the end_call tool disconnects.
2. **Unnamed caller:** Confirm the generic greeting and disconnect.
3. **Ready caller:** After the worker returns READY, verify normal personalised greeting, last-call summary, current Living Understanding and normal tool access.
4. **Other caller:** A different caller must remain able to converse while the first caller is processing; no cross-caller names or understanding appear.
5. **Failure state:** A FAILED job must retain the processing-only treatment and remain recoverable by the existing controlled manual recovery command; do not automatically mark the job READY.
6. **Idempotency and monitoring:** Check repeated webhook delivery does not create duplicate revisions, and check the monitor's revision links and failure visibility.

## Limitations

- The greeting and fail-closed response are implemented in this package. Live end-call behaviour depends on ElevenLabs `end_call` configuration and needs actual telephone verification.
- Missing webhook recovery, automatic retries and full cross-caller integration testing remain outstanding. This stage does not assert production pilot readiness.
- Relish identity continuity is phone-number-based for the restricted pilot. This is not verified authentication.
