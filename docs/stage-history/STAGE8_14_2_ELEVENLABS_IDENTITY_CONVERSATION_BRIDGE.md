# Stage 8.14.2 - ElevenLabs Identity and Conversation Bridge

## Purpose

Stage 8.14.2 closes the loop around Dorian calls without creating a second conversation system.

The same provider-independent Conversation source introduced in Stage 8.14.1 is used both before and after an ElevenLabs call:

1. ElevenLabs sends call-initiation data.
2. Relish resolves the caller inside the configured General ContextSpace.
3. Relish returns a bounded agent-facing view of the participant's authoritative Living Understanding.
4. After the call, ElevenLabs sends the signed post-call transcript webhook.
5. Relish resolves identity again, stores the immutable conversation, and attaches only participant speech as direct participant evidence.

No Living Understanding is automatically changed by a webhook. Existing human review/approval remains authoritative.

## Identity hierarchy

Identity resolution accepts multiple signals but fails closed when they disagree:

1. `relish_contact_id` supplied by Relish.
2. `relish_person_id` supplied by Relish.
3. caller phone number, normalized for telephony identity.
4. ElevenLabs `user_id` only when it corresponds to an already known Relish Contact/Person/linked user.

A phone number is an identifier, not the Person identity itself.

For Australian pilot calls, `04xx xxx xxx`, `614xxxxxxxx`, and `+614xxxxxxxx` normalize to the same E.164-style form. Existing formatted phone values remain resolvable through a bounded custody-local fallback.

## Pre-call endpoint

`POST /api/webhooks/elevenlabs/initiation`

Authentication:

`Authorization: Bearer <ELEVENLABS_INITIATION_SECRET>`

The endpoint is restricted to `ELEVENLABS_GENERAL_CONTEXT_SPACE_ID` and optionally `ELEVENLABS_AGENT_ID`.

When a participant is resolved, it returns these dynamic variables:

- `relish_identity_status`
- `relish_identity_method`
- `relish_contact_id`
- `relish_person_id`
- `participant_name`
- `relish_living_understanding`
- `relish_living_understanding_revision`

The Living Understanding value is a bounded agent view built from the current authoritative LU. Source transcripts and raw private evidence are not returned.

If identity is unresolved or conflicting, the call may still proceed with blank participant context. Relish does not guess.

## Post-call endpoint

`POST /api/webhooks/elevenlabs`

The existing ElevenLabs HMAC signature verification remains mandatory.

The post-call adapter now extracts:

- echoed `relish_contact_id` / `relish_person_id` dynamic variables
- caller phone number where provided by ElevenLabs/system variables
- ElevenLabs `user_id`

The same identity resolver is used after the call. Automatic attachment occurs only for a single unambiguous participant match. Otherwise the encrypted conversation remains in the Pending ElevenLabs conversations queue for operator assignment.

## General participant phone identity

General participants can now store or update a phone number. It is:

- normalized server-side
- encrypted in `phoneEnc`
- deterministically indexed in `phoneIdx`
- scoped to the General ContextSpace

This enables repeat inbound calls to resolve before Dorian begins speaking.

## Keepalive

Database keepalive remains opt-in:

- unset `DB_KEEPALIVE_ENABLED` = no periodic ping
- `DB_KEEPALIVE_ENABLED=YES` = enable periodic ping
- `DB_KEEPALIVE_DISABLED=YES` remains a compatibility override

## Environment

Required for post-call ingestion:

- `ELEVENLABS_POST_CALL_WEBHOOK_SECRET`
- `ELEVENLABS_GENERAL_CONTEXT_SPACE_ID`

Required for pre-call personalization:

- `ELEVENLABS_INITIATION_SECRET`
- `ELEVENLABS_GENERAL_CONTEXT_SPACE_ID`

Recommended:

- `ELEVENLABS_AGENT_ID`
- `TELEPHONY_DEFAULT_COUNTRY=AU`

Optional API recovery:

- `ELEVENLABS_API_KEY`

## Database

No Prisma schema migration is required for this revision. Phone identity uses the existing Contact encrypted/index fields.
