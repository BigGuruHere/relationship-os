# Dorian browser continuity

Signed-in users with active Foundation accounts can open **Talk to Dorian - to build my network** on Home. Normal profile and QR exchange can return them to Home using the existing navigation. The call is exploratory and focuses on what matters to the participant and the connections they would like to develop.

After the participant agrees to transcription, analysis and pilot review, Relish binds the ElevenLabs launch to their private vault, self subject and enrollment epoch before returning the browser token. The worker fetches the completed transcript even if the browser closes. It saves the exact speaker-labelled turns and runs the existing topic-first discovery, writing, evidence checks, repair and audit. An incomplete or held analysis produces no approved understanding.

Under **Operator tools → Dorian browser conversation reviews**, the Relish owner can inspect the transcript, evidence and audit, then approve selected updates. Review is limited to consented Dorian calls in an active vault. Approval records the operator and the decision in the existing revision lineage. The participant experience contains no review or approval screens. If a pending proposal becomes stale because another proposal has been approved, open it again and queue a new analysis against the latest baseline.

During later calls, the ElevenLabs server tool receives a bounded view of the participant's latest eligible, approved topics. It does not receive raw transcripts or review material. The browser receives a call token. Failed or pending analyses leave the last approved understanding available. The browser workflow uses a dedicated perspective for the existing self subject. The experimental contact-based workflows, histories and assessment engines are retained. Their **Talk to Dorian** links are removed from My People.

## DEV setup and acceptance

The additive migration `20261116010000_dorian_foundation_calls` is required. For a local database, use `npx prisma migrate dev`. The migration creates a queue and consent metadata table. Transcripts, analysis and evidence stay in their existing Foundation tables. Foundation erasure also removes the call metadata.

On the approved DEV deployment set:

- `RELISH_FOUNDATION_DORIAN=YES`
- `RELISH_FOUNDATION_DORIAN_AGENT_ID` to a dedicated private ElevenLabs WebRTC agent, separate from the telephone and contact experiment agents.
- `RELISH_FOUNDATION_DORIAN_TOOL_SECRET` to a dedicated secret. Configure the agent server tool with the same secret as an `Authorization: Bearer …` header.
- Use the existing ElevenLabs API key and the existing LU model configuration.

Configure the agent with a short introductory greeting. Instruct it to run its memory server tool at the beginning of each conversation before discussing earlier topics. Treat returned topics as participant context. Use them naturally, invite corrections, and proceed with a fresh conversation if the result is empty. Configure an opening workflow tool step if available. The tool makes a JSON POST to `/api/webhooks/elevenlabs/tools/foundation-memory` on the canonical DEV origin. Its single required body field, `conversation_id`, comes from ElevenLabs' `system__conversation_id` dynamic variable. The tool has no model-supplied identity fields. Confirm the DEV agent's transcript retrieval and audio retention settings. References are the [WebRTC token endpoint](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token) and [dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables).

The app supervisor starts the worker with the feature configuration above. The worker polls for completion, backs off on transient failures and recovers expired claims. Ready and held review material has a seven-day review window. Turning off `RELISH_FOUNDATION_DORIAN` and restarting the application stops launches, processing, memory and operator access. Leave the additive migration in place on rollback to retain records and preserve erasure support.

Before inviting the early users, take a first call and close the page after it ends. Confirm the transcript and proposal appear in the operator queue. Approve a topic, verify the memory tool is called and Dorian can use it on a later call, then confirm the later analysis preserves earlier evidence. Use two separate ordinary Foundation accounts to check isolation. Replay the previously saved hosted v6 transcript through its existing private DEV review to check for unsupported gendered wording and supported detail dropped in a rewrite. Confirm the second audit holds an unsuccessful repair before approval.
