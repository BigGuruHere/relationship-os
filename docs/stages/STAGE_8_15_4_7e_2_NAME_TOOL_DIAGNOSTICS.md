# Stage 8.15.4.7e.2 - Preferred Name Tool Diagnostics

## Finding
ElevenLabs reported HTTP 400 while calling `https://relish-proxy-server-production.up.railway.app/api/webhooks/elevenlabs/tools/save-preferred-name`. The supplied preferred name `Terrence` passes Relish's name validator. The Relish endpoint returns HTTP 400 only for malformed JSON/body or invalid name. As the request uses the separately deployed Railway webhook proxy, a proxy routing error is a plausible cause. This cannot be proven without proxy logs or a direct backend request. The ZIP does not include the independently deployed proxy source, and this stage does NOT modify the proxy.

## Changes
- Add structured `REQUEST`, `VALIDATE`, `RESPONSE`, and `ERROR` logging to `/api/webhooks/elevenlabs/tools/save-preferred-name`.
- Use a short per-request correlation ID.
- Record only parameter presence and result categories; never log names, bearer credentials, conversation IDs, session tokens, or Prisma SQL details.
- Handle unexpected errors with a safe HTTP 500 response.
- Add a regression test for logging behaviour.

## Installation
1. Back up/commit your current source.
2. Copy contents of `relationship-os-master` from complete ZIP into your Windows project folder, replacing matching source files but preserving `.env`.
3. No Prisma migration; no local production build.
4. Run `npm run check:stage8.15.4.7e` then `npm run check`.
5. Restart `npm run dev -- --port 8080`.

## Recommended end-to-end check
- Temporarily change the ElevenLabs DEVELOPMENT agent's tool URL to `<CURRENT_NGROK_HTTPS_ORIGIN>/api/webhooks/elevenlabs/tools/save-preferred-name` (do NOT use a guessed URL).
- Confirm the same Bearer tool secret is configured locally and in the ElevenLabs tool.
- Place a DEVELOPMENT test call and give a preferred name.
- Check Relish terminal for `[ElevenLabs][name-tool_<id>][REQUEST]`, `[VALIDATE]` and `[RESPONSE]`.
- If `REQUEST` appears, the request reached Relish; the status/reason points to Relish behaviour. If it does not appear, inspect ngrok/ElevenLabs/proxy routing.
- After the direct test, configure the production Railway proxy to forward this exact path to the environment pinned by the conversation, with appropriate authentication and no sensitive logging. Do not blindly route a production-labelled proxy to development.

## Verification
- Focused Stage 8.15.4.7e regression test: 5 passed, 0 failed.
- Selected prior stage tests: 7 passed, 0 failed.
- No live ngrok, ElevenLabs, Railway proxy or Neon tests run here.

## Remaining issues
- Validate actual proxy support and environment pinning for agent tools.
- Keep two-caller custody and webhook idempotency checks as external-pilot acceptance gates.
