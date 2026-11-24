# Dorian telephone continuity

The existing inbound Dorian agent can serve active Foundation accounts with a verified Australian mobile. For this pilot, the incoming number provisionally identifies the account for the call. That gives Dorian access to the account's eligible call context and lets a completed consented call update its Living Understanding. It grants no account login or channel verification. Unmatched numbers continue through the provisional telephone flow.

App and telephone use the same Foundation initiation module. A feature can supply a purpose with its own objective, conversation context and opening question. Both channels use the same private self subject, transcript queue, full LU assessment and operator review. The operator queue shows App or Telephone and the source records the capture channel alongside the existing provider and turn provenance. A queued call in the current vault and enrollment blocks another launch with a short processing message. An analysis in operator review lets the participant call again using the latest approved understanding.

The app uses its checkbox and sends `terms_agreed: true` after recording or recognising the current agreement. The telephone sends `terms_agreed: false` when agreement is required, and Relish queues the existing policy SMS with the current legal page. The agent asks for agreement and calls the existing voice tool. After an accepted tool result it uses the returned `startup_context`. Prior agreement on either channel counts for the shared account and policy version. There is no SMS identity challenge.

## Hosted DEV setup

Apply `20261124010000_dorian_foundation_telephone` before enabling telephone continuity. For a local development database use `npx prisma migrate dev`.

- Keep the existing Foundation browser configuration and set `RELISH_FOUNDATION_DORIAN_PHONE_AGENT_ID` to the shared inbound DEV Dorian agent ID. This is a separate agent ID from the browser agent. Use the existing shared binding, authenticated initiation webhook and signed post-call transcription webhook.
- Set `RELISH_PILOT_CONVERSATIONAL_TERMS=YES` with published legal documents, current policy version, the HTTPS DEV app origin and the existing Telnyx SMS settings. Foundation terms notices in DEV only queue for numbers in `RELISH_EXCHANGE_TEST_PHONES`. Use the environment's existing exchange realm and encryption configuration.
- Enable First message overrides and the built-in `end_call` tool. The telephone prompt must follow `{{call_instruction}}` and treat `{{terms_agreed}}` as a Boolean. Use the existing legacy dynamic-variable defaults for standalone agent tests. On a processing-only or unavailable response, have Dorian speak the first message and invoke `end_call`.
- The existing `record_relish_policy_acceptance` tool posts to `/api/webhooks/elevenlabs/tools/record-policy-acceptance` using `ELEVENLABS_TOOL_SECRET`. Bind `conversation_id` and `relish_network_session` to provider runtime values and collect `agreement=true` only after explicit agreement. When the tool returns `ACCEPTED` with `startup_context`, use that context for the rest of the call. Use the returned processing message followed by `end_call` if a concurrent call returns `PROCESSING`. An error or refusal ends the call.
- Confirm both provider agents' completed transcripts are readable with the existing ElevenLabs API key. Turning off `RELISH_FOUNDATION_DORIAN_PHONE_AGENT_ID` returns new calls to the original routing. Keep the additive migration and existing evidence.

## Hosted acceptance

1. Start in the app and accept by checkbox. Confirm the launch sends `terms_agreed: true` and the operator can review the call. Call from the verified mobile after approving a topic. Confirm the greeting and recall, and that a second policy prompt and SMS are skipped.
2. Introduce a new substantive detail by telephone. Check that the call appears once under Operator tools and that its evidence points to the telephone source. Approve it and verify continuity on an app call.
3. Use a second account with a verified mobile and no current agreement. Confirm that the phone receives the policy SMS, initial context contains no private memory, and the agent records explicit agreement through the tool. Check that the subsequent app call recognises that agreement. Repeat with refusal or hang-up and verify that nothing enters the LU queue.
4. Call back on both channels while analysis is queued, then again while the result is waiting for operator review. Check the processing message, the release for subsequent calls, and isolation between the two accounts. Also verify legacy routing for an unmatched number and that a revoked mobile cannot enter the Foundation path.
