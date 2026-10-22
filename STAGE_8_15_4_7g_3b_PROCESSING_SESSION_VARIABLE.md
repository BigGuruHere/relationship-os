# Stage 8.15.4.7g.3b: Processing-call session variable contract

## Problem
ElevenLabs rejected a processing-wait call because its agent prompt/tools reference `relish_network_session`, but the initiation `PROCESSING` response omitted the key.

## Fix
- `READY` sends the existing real `relish_network_session` token as before.
- `PROCESSING` sends the literal `PROCESSING_NO_SESSION`, never a valid credential. It provides the personalised waiting first message and directs the agent to invoke `end_call` immediately.
- `UNRESOLVED` also supplies the literal `UNRESOLVED_NO_SESSION`, avoiding the same missing-variable validation problem. Neither sentinel should be accepted by any Relish authenticated tool.
- No change to post-call handling, readiness state, Living Understanding processing, or private context delivery.

## Installation
Use the complete source ZIP to replace the matching project files, preserving `.env` and local secrets. Database migration: **No**. Local build: **Not required**.

## Verification
Run `node --test tests/core/stage8-15-4-7g-3b-processing-session-contract.test.mjs` and `npm run check`. In ElevenLabs, confirm the `end_call` tool is enabled and the processing-only prompt instruction remains active. Call again while the last conversation is processing and verify the greeting plays, then terminates. Ensure authenticated tool calls using the sentinel are rejected. Check a normal returning call still receives a real token and succeeds.
