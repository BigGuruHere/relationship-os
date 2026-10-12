# Stage 8.14.2.1 - ElevenLabs Bridge Observability

## Purpose

Add substantial development logging around the ElevenLabs <-> Relish bridge so initiation and post-call tests can be inspected from the Relish terminal without changing custody, identity, ingestion, or Living Understanding behaviour.

## Configuration

Logging is deliberately off by default.

Set:

```env
ELEVENLABS_DEBUG_LOGGING=YES
```

to display structured lifecycle logs for both endpoints.

For local development only, also set:

```env
ELEVENLABS_DEBUG_LOG_PAYLOADS=YES
```

to print the complete initiation request/response and post-call event/normalized transcript. These payloads can contain participant speech and Living Understanding text, so this second flag should normally remain unset outside a controlled development environment.

Authentication credentials are never printed. Authorization headers, webhook signatures, secrets and API-key-shaped fields are redacted by the logging helper.

## Initiation trace

`POST /api/webhooks/elevenlabs/initiation` now logs:

- inbound request arrival and content type
- presence, but not value, of Authorization
- authorization result
- agent id, called number, caller id, user id and Relish identity hints
- full request payload when payload logging is enabled
- stable agent deployment resolution
- workspace/ContextSpace custody entry
- participant identity resolution
- the bounded initiation data summary being returned
- full returned dynamic variables when payload logging is enabled
- errors with a correlation trace id

## Post-call trace

`POST /api/webhooks/elevenlabs` now logs:

- inbound event arrival and body size
- presence, but not value, of ElevenLabs signature
- signature result
- event type, conversation id, agent id, user id and transcript-row count
- full signed event when payload logging is enabled
- normalized caller/called numbers, turn counts, speaker list and dynamic-variable keys
- normalized transcript when payload logging is enabled
- stable agent deployment resolution
- custody entry
- immutable conversation storage and idempotency result
- participant identity resolution
- participant evidence attachment, or why it remained unattached
- final acknowledgement returned to ElevenLabs

Every inbound request receives a short trace id such as `el-init_a1b2c3d4` or `el-post_a1b2c3d4`, making one request easy to follow through the terminal.

## Database / migrations

No schema change and no Prisma migration.
