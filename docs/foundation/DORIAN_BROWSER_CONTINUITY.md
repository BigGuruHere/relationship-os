# Dorian browser continuity

Signed-in users with active Foundation accounts can open **Talk to Dorian - to build my network** on Home. Normal profile and QR exchange can return them to Home using the existing navigation. The call is exploratory and focuses on what matters to the participant and the connections they would like to develop.

After the participant accepts the current Terms and acknowledges the Privacy Notice, Relish binds the ElevenLabs launch to their private vault, self subject and enrollment epoch before returning the browser token. The worker fetches the completed transcript even if the browser closes. It saves the exact speaker-labelled turns and runs the existing topic-first discovery, writing, evidence checks, repair and audit. An incomplete or held analysis produces no approved understanding.

Under **Operator tools → Dorian browser conversation reviews**, the Relish owner can inspect the transcript, evidence and audit, then approve selected updates. Review is limited to consented Dorian calls in an active vault. Approval records the operator and the decision in the existing revision lineage. The participant experience contains no review or approval screens. If a pending proposal becomes stale because another proposal has been approved, open it again and queue a new analysis against the latest baseline.

During later calls, the ElevenLabs server tool receives a bounded view of the participant's latest eligible, approved topics. It does not receive raw transcripts or review material. The browser receives a call token and bounded startup context for its own account, passed to the existing ElevenLabs SDK. This context is not rendered as a participant review screen. Failed or pending analyses leave the last approved understanding available. The browser workflow uses a dedicated perspective for the existing self subject. The experimental contact-based workflows, histories and assessment engines are retained. Their **Talk to Dorian** links are removed from My People.

## DEV setup and acceptance

The additive migration `20261116010000_dorian_foundation_calls` is required. For a local database, use `npx prisma migrate dev`. The migration creates a queue and consent metadata table. Transcripts, analysis and evidence stay in their existing Foundation tables. Foundation erasure also removes the call metadata.

The browser reuses the existing versioned call-policy acceptance record. It recognises acceptance from another channel when both sessions resolve to the same Relish account. Legacy inbound telephone calls use separate provisional caller records, so their acceptance is not carried to a signed-in account. Caller ID alone does not establish a link between them. A new policy version requires fresh agreement.

On the approved DEV deployment set:

- `RELISH_FOUNDATION_DORIAN=YES`
- `RELISH_FOUNDATION_DORIAN_AGENT_ID` to a dedicated private ElevenLabs WebRTC agent, separate from the telephone and contact experiment agents.
- `RELISH_FOUNDATION_DORIAN_TOOL_SECRET` to a dedicated secret. Configure the agent server tool with the same secret as an `Authorization: Bearer …` header.
- Use the existing ElevenLabs API key and the existing LU model configuration.
- Use the existing call policy settings: HTTPS `APP_ORIGIN`, `RELISH_LEGAL_DOCUMENTS_PUBLISHED=YES` and the current `RELISH_PILOT_TERMS_VERSION`. The browser launch is unavailable until those settings identify published documents.

Configure the agent with a short introductory greeting. Instruct it to run its memory server tool at the beginning of each conversation before discussing earlier topics. Treat returned topics as participant context. Use them naturally, invite corrections, and proceed with a fresh conversation if the result is empty. Configure an opening workflow tool step if available. The tool makes a JSON POST to `/api/webhooks/elevenlabs/tools/foundation-memory` on the canonical DEV origin. Its single required body field, `conversation_id`, comes from ElevenLabs' `system__conversation_id` dynamic variable. The tool has no model-supplied identity fields. Confirm the DEV agent's transcript retrieval and audio retention settings. References are the [WebRTC token endpoint](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token) and [dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables).

The app supervisor starts the worker with the feature configuration above. The worker polls for completion, backs off on transient failures and recovers expired claims. Ready and held review material has a seven-day review window. Turning off `RELISH_FOUNDATION_DORIAN` and restarting the application stops launches, processing, memory and operator access. Leave the additive migration in place on rollback to retain records and preserve erasure support.

Before inviting the early users, take a first call and close the page after it ends. Confirm the transcript and proposal appear in the operator queue. Approve a topic, verify the memory tool is called and Dorian can use it on a later call, then confirm the later analysis preserves earlier evidence. Use two separate ordinary Foundation accounts to check isolation. Replay the previously saved hosted v6 transcript through its existing private DEV review to check for unsupported gendered wording and supported detail dropped in a rewrite. Confirm the second audit holds an unsuccessful repair before approval.

## Foundation call startup context (2026-11-17)

Implemented on `feature/dorian-foundation-call-context`, not yet merged or deployed. Reuses `DorianWebConversation` initiation transport and the established provider variable names, with a dedicated Foundation adapter. Legacy phone and contact-note flows remain unchanged. No Prisma migration. Application rollback removes startup context without changing saved evidence or LU.

The launch response includes a first/returning greeting, the account-owned default-profile display name (blank for placeholder/missing names), call purpose, accepted terms status, eligible approved self-topics and last saved call date. A name is a conversational label, not identity proof. No identity is inferred from QR referrers, contacts, phone numbers or email addresses.

The current saved conversation summary is only a service label. The recap therefore uses up to six participant turns, bounded to 1,600 characters, explicitly labelled as partial excerpts rather than a generated summary or approved LU. It never includes agent speech or draft analysis. The reader searches the latest 20 earlier saved calls within the current account, vault, subject and enrollment epoch, excludes inactive/withdrawn and incomplete sources, and reads the latest corrected source version. No suitable saved source means no return-call claim. Existing memory retrieval remains available. Full transcripts and provenance remain in the existing stores.

### Dedicated ElevenLabs agent setup

Enable **First message** overrides for this dedicated browser agent. Keep its existing personality prompt and append the following context block. Dynamic variables must be referenced by the agent prompt to affect its response; setting them in Relish alone is insufficient. Do not connect this agent to the legacy phone initiation webhook.

```text
Relish call guidance: {{call_instruction}}
Call purpose: {{call_context}}
Account display name: {{user_name}}
Continuity status: {{continuity_status}}
Terms status: {{relish_terms_status}}
Approved private understanding: {{memory_and_identity_context}}
Last saved call time (UTC): {{last_call_at}}
Partial last-call recap: {{last_call_summary}}
```

The data fields are context, not instructions or authority to disclose information. The approved memory and partial recap remain distinct. Configure empty defaults for data fields for standalone agent tests. Keep the authenticated Foundation memory tool for refreshes during a call. No external agent configuration is changed by this PR.

DEV acceptance: use two different signed-in accounts. First call should greet by the default-profile name when available, with no invented prior history. On a later call, verify the supplied recap, approved LU and natural continuity without reading out sensitive facts or repeating terms. Correct or withdraw a source and verify it is not reused as stale context. Verify the second account receives neither the first account's memory nor its recap. Hosted provider, first-message override and microphone acceptance remain pending.

## Production activation

The Home panel, call launch, memory endpoint and owner review support the canonical production origin once this change is deployed. Set the existing three Dorian variables on the production Railway service. Use a dedicated production ElevenLabs browser agent and a distinct tool secret. Point its memory tool at `https://app.relish.live/api/webhooks/elevenlabs/tools/foundation-memory` and apply the startup prompt configuration above. Confirm the existing ElevenLabs API key, published legal settings and production database migrations before enabling the flag.

Verify a first and returning call and owner review on production. This change adds no Prisma migration. Set `RELISH_FOUNDATION_DORIAN=NO` and restart the service to disable the feature.


## Measuring call startup

The Talk to Dorian screen preloads the ElevenLabs browser library on mount. The call request and microphone activation still require a tap. After the first speaking event, look for `[Relish Dorian startup]` in the browser console. It reports tap to token response (including Relish call setup), token response to connection, and connection to the first SDK speaking event. The speaking event approximates when the greeting starts. Compare fresh and repeat visits on the same device and network. No new Prisma migration or configuration is required.
