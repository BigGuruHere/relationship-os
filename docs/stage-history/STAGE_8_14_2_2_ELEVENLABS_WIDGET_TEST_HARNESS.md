# Stage 8.14.2.2 - ElevenLabs Widget and Initiation Test Harness

## Purpose

Provide a development-only workflow for testing the Relish ElevenLabs bridge before the Telnyx number is available.

The harness deliberately separates two behaviours that ElevenLabs treats differently:

1. A real HTTP request is sent through the configured public/ngrok origin to Relish's Conversation Initiation endpoint.
2. The ElevenLabs web widget is then started with the exact `dynamic_variables` returned by that initiation request.

The widget itself does not invoke the Conversation Initiation webhook. This page makes the two halves testable together.

## Route

`/settings/agents/test`

The existing Agent deployments page links to it.

## Default test identity

The current development Person UUID defaults to:

`c21edd22-344e-4529-99ab-83a9e2ada688`

Override it without changing source using:

`ELEVENLABS_TEST_PERSON_ID=<uuid>`

## Public test origin

The default public origin is the existing development ngrok hostname:

`https://creative-basilisk-painfully.ngrok-free.app`

Override it with:

`ELEVENLABS_TEST_PUBLIC_ORIGIN=https://...`

The test action POSTs to `/api/webhooks/elevenlabs/initiation` at that origin, so when ngrok targets the local Relish port the request exercises the same public path ElevenLabs will later use.

## Security

- Requires an authenticated Relish session.
- Only active ElevenLabs bindings owned by the current user can be selected.
- `ELEVENLABS_INITIATION_SECRET` remains server-side and is never rendered into the browser.
- The returned agent context is visible on this development page, so this route should be treated as a developer/admin surface.
- No Prisma migration is required.
