# Stage 8.14.2.3 - Dorian compatibility context

This stage keeps the existing ElevenLabs Dorian agent usable while Relish becomes the authoritative identity and Living Understanding system.

## Changes

- The initiation bridge now returns the existing Dorian dynamic-variable contract alongside the newer `relish_*` variables.
- `memory_and_identity_context` is projected from the bounded current Living Understanding, not from raw source conversations.
- `user_id` is the stable Relish Person id when available, otherwise the custody-local Contact id.
- `agent_id` is the current ElevenLabs provider agent id for the active provider binding.
- The widget test harness accepts either a Contact UUID or Person UUID and explicitly shows how it resolved the input.
- The harness remains ContextSpace-scoped and fails instead of searching across custody boundaries.

The following legacy variables are supplied with safe string defaults so an existing ElevenLabs agent can connect before every historical feature is reimplemented: `memory_and_identity_context`, `call_instruction`, `call_type`, `user_name`, `previous_calls`, `user_id`, `agent_id`, `last_call_summary`, `emotion_label`, `agent_website`, and `agent_type`.

`previous_calls`, `last_call_summary`, `emotion_label`, and `agent_website` are intentionally empty in this stage. They are not fabricated. They can be backed by explicit Relish projections in a later stage.

No Prisma migration is required.
