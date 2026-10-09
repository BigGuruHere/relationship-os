# Stage 8.14.1.2 - General Conversation ContextSpace

## Purpose

Add a first-class `general` application ContextSpace for broad Dorian conversations, participant research and Living Understanding that should not be stored inside Dating or Business.

## Boundary

- `business`, `dating` and `general` remain separate route-owned ContextSpace domains.
- A General participant is a ContextSpace-local Contact shell. This stage does not automatically copy or merge Dating or Business contacts.
- Conversation import stores the same provider-aware encrypted conversation envelope introduced in Stage 8.14.1.
- Only mapped participant turns are direct evidence about that participant. Agent turns remain conversational context.
- Living Understanding approval changes private authoritative understanding only. It does not grant matching, sharing or disclosure permission.

## User flow

1. Settings -> Application spaces -> Create General space.
2. Open General -> People.
3. Create a participant shell.
4. Import a Dorian/ElevenLabs transcript.
5. Map the participant speaker and retain the agent as context-only.
6. Create initial Living Understanding or review impact on the existing Living Understanding.

## Architecture

`/general/...` is a server-owned domain boundary resolved by `contextDomainForPathname`. The same Core conversation and Living Understanding services are used by Dating and General after owner + ContextSpace validation. The manual transcript screen remains only an ingestion adapter, so a later ElevenLabs webhook/API adapter can write the same conversation source without changing downstream semantics.

## Database

No Prisma schema migration is required. `ContextSpace.domainKey` is intentionally extensible and General spaces are created through the existing controlled ContextSpace directory.
