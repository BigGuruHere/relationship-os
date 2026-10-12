# Stage 8.14.2 - Stable Agent Identity and Replaceable Provider Deployments

## Purpose

Relish now owns the durable identity of an agent. External provider identifiers such as an ElevenLabs `agent_id` and an inbound telephone number are deployment bindings that may change without changing the Relish agent.

This supersedes the earlier Stage 8.14.2 assumption that one deployment could be selected by `ELEVENLABS_AGENT_ID` or `ELEVENLABS_GENERAL_CONTEXT_SPACE_ID` environment variables.

## Data model

`AgentDefinition` remains the stable Relish agent record. `AgentProviderBinding` connects that agent to:

- provider (`ELEVENLABS` initially)
- environment (`DEVELOPMENT`, `TEST`, `PRODUCTION`)
- encrypted provider agent id plus scoped HMAC lookup index
- encrypted inbound telephone number plus scoped HMAC lookup index
- target ContextSpace
- validity interval and active/historical state

Replacing a binding closes the old validity interval and creates a new row. Old conversations can therefore still be interpreted using the provider assignment that was valid when the conversation occurred.

## Runtime resolution

At call initiation Relish resolves the deployment from `agent_id`, `called_number`, or both. When both are present they are cross-checked. A known called number plus a newly-created provider agent id may resolve to the same logical agent with a warning, so moving a telephone number to a replacement ElevenLabs agent does not immediately break Dorian. A genuine disagreement between two different Relish agents fails closed.

The resolved deployment determines the owner and ContextSpace. Caller identity is resolved separately inside that custody boundary.

Post-call transcription uses the same resolver, with the conversation occurrence time so historical bindings remain meaningful after a deployment has been replaced.

## Admin UI

`/settings/agents` provides:

- creation of a stable logical Relish conversation agent
- creation of an ElevenLabs provider binding
- replacement of an active binding while retaining history
- deactivation of a binding
- display of current and historical assignments

The page means development/test/production agent changes do not require a source-code or `.env` edit.

## Environment configuration

Still required:

- `ELEVENLABS_WEBHOOK_SECRET` for post-call HMAC verification
- `ELEVENLABS_INITIATION_SECRET` for the pre-call initiation endpoint
- `ELEVENLABS_API_KEY` only when API fetch/recovery is wanted

No longer required:

- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_GENERAL_CONTEXT_SPACE_ID`

Database keepalive remains opt-in through `DB_KEEPALIVE_ENABLED=YES`; it is off when unset.

## Migration

Forward migration:

`20261009023000_stage8_14_2_agent_provider_bindings`

No previously deployed migration was edited.
