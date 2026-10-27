# Stage 8.14.2 - Direct ElevenLabs Conversation Ingestion

## Purpose

Connect completed ElevenLabs conversations to the provider-independent conversation ingestion foundation created in Stage 8.14.1, without coupling Living Understanding to ElevenLabs.

## Behaviour

- Adds `POST /api/webhooks/elevenlabs` for ElevenLabs `post_call_transcription` events.
- Verifies the `ElevenLabs-Signature` HMAC over `timestamp.rawBody` before payload processing.
- Routes webhook ingestion only into the explicitly configured General ContextSpace.
- Stores the complete normalized User/Agent transcript as an encrypted `CONVERSATION_TRANSCRIPT` source.
- Uses the ElevenLabs `conversation_id` as the provider idempotency key, hashed before it reaches `Interaction.externalRef`.
- Does not run AI or update Living Understanding automatically.
- If `conversation_initiation_client_data.dynamic_variables.relish_contact_id` is present and belongs to the configured General ContextSpace, the User turns can be attached immediately to that participant.
- Otherwise the conversation appears in the General pending conversation inbox for explicit operator assignment.
- Adds authenticated API recovery/import by ElevenLabs conversation ID using `GET /v1/convai/conversations/{conversation_id}`.
- Only User turns become direct participant evidence. Agent turns remain contextual source.

## Environment

Required for automatic webhook ingestion:

```env
ELEVENLABS_POST_CALL_WEBHOOK_SECRET=...
ELEVENLABS_GENERAL_CONTEXT_SPACE_ID=...
```

Optional but recommended:

```env
ELEVENLABS_AGENT_ID=...
ELEVENLABS_WEBHOOK_MAX_AGE_SECONDS=300
```

Required for operator API fetch/recovery:

```env
ELEVENLABS_API_KEY=...
```

The webhook URL is:

```text
https://<your-host>/api/webhooks/elevenlabs
```

## Database keepalive

Keepalive is now opt-in. With no setting, no periodic database ping is created.

To enable it deliberately:

```env
DB_KEEPALIVE_ENABLED=YES
DB_KEEPALIVE_MINUTES=4
```

`DB_KEEPALIVE_DISABLED=YES` remains accepted as a compatibility override for older database-test scripts.

## Database

No Prisma schema migration is required for Stage 8.14.2. Stage 8.14.1.1 already permits subjectless API conversation originals.

## Custody

Webhook ingress uses the named `ELEVENLABS_CONVERSATION_INGEST` external-custody transition. Its allowlist is limited to the Interaction reads/writes and Contact lookup required for this ingestion path. It does not grant cross-context sharing, matching, disclosure, or AI-processing permission.
